import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';
import pool from '../db';

interface PhotoMetadata {
  title?: string;
  description?: string;
  tags: string[];
  userId: string;
  relativePath?: string;
  thumbnail?: string;
}

export class GlacierPhotoService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'glacier-photo-vault';
  }

  /**
   * Record uploaded photo metadata to DB (File is already in S3 via multer-s3)
   */
  async recordUpload(
    file: Express.Multer.File,
    metadata: PhotoMetadata
  ): Promise<Photo> {
    const photoId = uuidv4();
    // file.key is populated by multer-s3
    const s3Key = (file as any).key;

    const photo: Photo = {
      id: photoId,
      userId: metadata.userId,
      filename: `${photoId}_${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      s3Key,
      status: PhotoStatus.ARCHIVED,
      uploadedAt: Date.now(),
      thumbnailUrl: metadata.thumbnail,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO photos (
          id, user_id, filename, original_name, mime_type, size, 
          title, description, s3_key, status, uploaded_at, thumbnail_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
      `, [
        photo.id,
        photo.userId,
        photo.filename,
        photo.originalName,
        photo.mimeType,
        photo.size,
        photo.title,
        photo.description,
        photo.s3Key,
        photo.status,
        photo.uploadedAt,
        photo.thumbnailUrl
      ]);

      if (metadata.tags && metadata.tags.length > 0) {
        for (const tag of metadata.tags) {
          if (tag && tag.trim()) {
            await client.query(
              'INSERT INTO photo_tags (photo_id, tag) VALUES ($1, $2)',
              [photoId, tag.trim()]
            );
          }
        }
      }

      await client.query('COMMIT');
      return photo;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get photo metadata by ID
   */
  async getPhoto(photoId: string): Promise<Photo | null> {
    const res = await pool.query('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const tagsRes = await pool.query('SELECT tag FROM photo_tags WHERE photo_id = $1', [photoId]);

    return this.mapRowToPhoto(row, tagsRes.rows.map((t: any) => t.tag));
  }

  /**
   * Get all photos for a user
   */
  async getUserPhotos(userId: string): Promise<Photo[]> {
    const res = await pool.query('SELECT * FROM photos WHERE user_id = $1 ORDER BY uploaded_at DESC', [userId]);

    // Fetch tags for all photos
    // Optimization: Fetch all tags for these photos in one query
    const photoIds = res.rows.map((r: any) => r.id);
    let tagsMap = new Map<string, string[]>();

    if (photoIds.length > 0) {
      const tagsRes = await pool.query(
        'SELECT photo_id, tag FROM photo_tags WHERE photo_id = ANY($1)',
        [photoIds]
      );

      tagsRes.rows.forEach((row: any) => {
        if (!tagsMap.has(row.photo_id)) {
          tagsMap.set(row.photo_id, []);
        }
        tagsMap.get(row.photo_id)!.push(row.tag);
      });
    }

    return res.rows.map((row: any) => {
      return this.mapRowToPhoto(row, tagsMap.get(row.id) || []);
    });
  }

  private mapRowToPhoto(row: any, tags: string[]): Photo {
    return {
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.size), // Postgres returns BIGINT as string
      title: row.title,
      description: row.description,
      tags: tags,
      s3Key: row.s3_key,
      status: row.status as PhotoStatus,
      uploadedAt: Number(row.uploaded_at),
      thumbnailUrl: row.thumbnail_url,
      restoredUntil: row.restored_until ? Number(row.restored_until) : undefined
    };
  }

  /**
   * Request restoration from Glacier Deep Archive
   */
  async requestRestore(
    photoId: string,
    tier: 'Standard' | 'Bulk' = 'Standard'
  ): Promise<void> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    if (photo.status === PhotoStatus.RESTORED) {
      return;
    }

    try {
      const restoreCommand = new RestoreObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
        RestoreRequest: {
          Days: 7,
          GlacierJobParameters: {
            Tier: tier,
          },
        },
      });

      await this.s3Client.send(restoreCommand);

      // Update status in DB
      await pool.query(
        'UPDATE photos SET status = $1 WHERE id = $2',
        [PhotoStatus.RESTORE_REQUESTED, photoId]
      );
    } catch (error: any) {
      if (error.name === 'RestoreAlreadyInProgress') {
        await pool.query(
          'UPDATE photos SET status = $1 WHERE id = $2',
          [PhotoStatus.RESTORING, photoId]
        );
        return;
      }
      console.error('Error requesting restore:', error);
      throw new Error('Failed to request photo restoration');
    }
  }

  /**
   * Check restore status
   */
  async checkRestoreStatus(photoId: string): Promise<PhotoStatus> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      const response = await this.s3Client.send(headCommand);
      let newStatus = photo.status;
      let restoredUntil: number | undefined = undefined;

      if (response.Restore) {
        const restoreStatus = response.Restore;

        if (restoreStatus.includes('ongoing-request="false"')) {
          newStatus = PhotoStatus.RESTORED;
          const expiryMatch = restoreStatus.match(/expiry-date="([^"]+)"/);
          if (expiryMatch) {
            restoredUntil = new Date(expiryMatch[1]).getTime();
          }
        } else if (restoreStatus.includes('ongoing-request="true"')) {
          newStatus = PhotoStatus.RESTORING;
        }
      } else if (response.StorageClass === 'DEEP_ARCHIVE') {
        newStatus = PhotoStatus.ARCHIVED;
      }

      if (newStatus !== photo.status || restoredUntil !== photo.restoredUntil) {
        await pool.query(
          'UPDATE photos SET status = $1, restored_until = $2 WHERE id = $3',
          [newStatus, restoredUntil, photoId]
        );
      }

      return newStatus;
    } catch (error) {
      console.error('Error checking restore status:', error);
      throw new Error('Failed to check restore status');
    }
  }

  /**
   * Get download URL for restored photo
   */
  async getDownloadUrl(photoId: string, expiresIn: number = 3600): Promise<string> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    await this.checkRestoreStatus(photoId);

    // Re-fetch to get updated status
    const updatedPhoto = await this.getPhoto(photoId);
    if (updatedPhoto?.status !== PhotoStatus.RESTORED) {
      throw new Error('Photo is not yet restored. Please request restoration first.');
    }

    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, getCommand, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete photo
   */
  async deletePhoto(photoId: string): Promise<void> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      await this.s3Client.send(deleteCommand);

      await pool.query('DELETE FROM photos WHERE id = $1', [photoId]);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error('Failed to delete photo');
    }
  }

  /**
   * Update photo metadata
   */
  async updatePhotoMetadata(
    photoId: string,
    updates: Partial<PhotoMetadata>
  ): Promise<Photo> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.title !== undefined) {
        await client.query('UPDATE photos SET title = $1 WHERE id = $2', [updates.title, photoId]);
      }
      if (updates.description !== undefined) {
        await client.query('UPDATE photos SET description = $1 WHERE id = $2', [updates.description, photoId]);
      }
      if (updates.tags !== undefined) {
        await client.query('DELETE FROM photo_tags WHERE photo_id = $1', [photoId]);
        for (const tag of updates.tags) {
          if (tag && tag.trim()) {
            await client.query(
              'INSERT INTO photo_tags (photo_id, tag) VALUES ($1, $2)',
              [photoId, tag.trim()]
            );
          }
        }
      }

      await client.query('COMMIT');
      return (await this.getPhoto(photoId))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get storage statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalPhotos: number;
    totalSize: number;
    archived: number;
    restoring: number;
    restored: number;
  }> {
    const res = await pool.query(`
      SELECT 
        COUNT(*) as total_photos,
        COALESCE(SUM(size), 0) as total_size,
        SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status IN ('RESTORING', 'RESTORE_REQUESTED') THEN 1 ELSE 0 END) as restoring,
        SUM(CASE WHEN status = 'RESTORED' THEN 1 ELSE 0 END) as restored
      FROM photos
      WHERE user_id = $1
    `, [userId]);

    const stats = res.rows[0];

    return {
      totalPhotos: Number(stats.total_photos),
      totalSize: Number(stats.total_size),
      archived: Number(stats.archived),
      restoring: Number(stats.restoring),
      restored: Number(stats.restored),
    };
  }

  /**
   * Get all unique tags for a user
   */
  async getUserTags(userId: string): Promise<string[]> {
    const res = await pool.query(`
      SELECT DISTINCT t.tag 
      FROM photo_tags t
      JOIN photos p ON t.photo_id = p.id
      WHERE p.user_id = $1
      ORDER BY t.tag
    `, [userId]);

    return res.rows.map((r: any) => r.tag);
  }

  /**
   * Get monthly storage statistics for a user (last 12 months)
   */
  async getMonthlyStats(userId: string): Promise<Array<{
    month: string;
    totalSize: number;
    photoCount: number;
  }>> {
    const photos = await this.getUserPhotos(userId);

    const monthlyData = new Map<string, { totalSize: number; photoCount: number }>();
    photos.forEach(photo => {
      const date = new Date(photo.uploadedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { totalSize: 0, photoCount: 0 });
      }
      const data = monthlyData.get(monthKey)!;
      data.totalSize += photo.size;
      data.photoCount += 1;
    });

    const result: Array<{ month: string; totalSize: number; photoCount: number }> = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const data = monthlyData.get(monthKey) || { totalSize: 0, photoCount: 0 };
      result.push({
        month: monthKey,
        totalSize: data.totalSize,
        photoCount: data.photoCount,
      });
    }

    return result;
  }
}
