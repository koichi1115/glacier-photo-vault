import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';

interface PhotoMetadata {
  title?: string;
  description?: string;
  tags: string[];
  userId: string;
}

export class GlacierPhotoService {
  private s3Client: S3Client;
  private bucketName: string;
  private photos: Map<string, Photo>; // In-memory storage for demo (use DB in production)

  constructor() {
    // Debug: Check if environment variables are loaded
    console.log('🔍 AWS Configuration Check:');
    console.log('AWS_REGION:', process.env.AWS_REGION);
    console.log('AWS_ACCESS_KEY_ID length:', process.env.AWS_ACCESS_KEY_ID?.length || 0);
    console.log('AWS_SECRET_ACCESS_KEY length:', process.env.AWS_SECRET_ACCESS_KEY?.length || 0);
    console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'glacier-photo-vault';
    this.photos = new Map();
  }

  /**
   * Upload photo to S3 with Glacier Deep Archive storage class
   */
  async uploadPhoto(
    file: Express.Multer.File,
    metadata: PhotoMetadata
  ): Promise<Photo> {
    const photoId = uuidv4();
    const s3Key = `photos/${metadata.userId}/${photoId}/${file.originalname}`;

    try {
      // Upload to S3 with Glacier Deep Archive storage class
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        StorageClass: 'DEEP_ARCHIVE', // Glacier Deep Archive
        Metadata: {
          photoId,
          userId: metadata.userId,
          title: metadata.title || '',
          description: metadata.description || '',
          tags: metadata.tags.join(','),
        },
      });

      await this.s3Client.send(putCommand);

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
      };

      this.photos.set(photoId, photo);
      return photo;
    } catch (error) {
      console.error('Error uploading photo to Glacier:', error);
      throw new Error('Failed to upload photo');
    }
  }

  /**
   * Get photo metadata by ID
   */
  async getPhoto(photoId: string): Promise<Photo | null> {
    return this.photos.get(photoId) || null;
  }

  /**
   * Get all photos for a user
   */
  async getUserPhotos(userId: string): Promise<Photo[]> {
    return Array.from(this.photos.values()).filter(
      (photo) => photo.userId === userId
    );
  }

  /**
   * Request restoration from Glacier Deep Archive
   * Standard tier: 12 hours
   * Bulk tier: 48 hours
   */
  async requestRestore(
    photoId: string,
    tier: 'Standard' | 'Bulk' = 'Standard'
  ): Promise<void> {
    const photo = this.photos.get(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    if (photo.status === PhotoStatus.RESTORED) {
      // Already restored
      return;
    }

    try {
      const restoreCommand = new RestoreObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
        RestoreRequest: {
          Days: 7, // Keep restored copy for 7 days
          GlacierJobParameters: {
            Tier: tier,
          },
        },
      });

      await this.s3Client.send(restoreCommand);

      // Update photo status
      photo.status = PhotoStatus.RESTORE_REQUESTED;
      this.photos.set(photoId, photo);
    } catch (error: any) {
      if (error.name === 'RestoreAlreadyInProgress') {
        photo.status = PhotoStatus.RESTORING;
        this.photos.set(photoId, photo);
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
    const photo = this.photos.get(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      const response = await this.s3Client.send(headCommand);

      if (response.Restore) {
        const restoreStatus = response.Restore;

        if (restoreStatus.includes('ongoing-request="false"')) {
          // Restore is complete
          photo.status = PhotoStatus.RESTORED;

          // Extract expiry date
          const expiryMatch = restoreStatus.match(/expiry-date="([^"]+)"/);
          if (expiryMatch) {
            photo.restoredUntil = new Date(expiryMatch[1]).getTime();
          }
        } else if (restoreStatus.includes('ongoing-request="true"')) {
          // Restore is in progress
          photo.status = PhotoStatus.RESTORING;
        }
      } else if (response.StorageClass === 'DEEP_ARCHIVE') {
        // Still in deep archive
        photo.status = PhotoStatus.ARCHIVED;
      }

      this.photos.set(photoId, photo);
      return photo.status;
    } catch (error) {
      console.error('Error checking restore status:', error);
      throw new Error('Failed to check restore status');
    }
  }

  /**
   * Get download URL for restored photo
   */
  async getDownloadUrl(photoId: string, expiresIn: number = 3600): Promise<string> {
    const photo = this.photos.get(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    // Check if photo is restored
    await this.checkRestoreStatus(photoId);

    if (photo.status !== PhotoStatus.RESTORED) {
      throw new Error('Photo is not yet restored. Please request restoration first.');
    }

    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      // Generate presigned URL
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
    const photo = this.photos.get(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: photo.s3Key,
      });

      await this.s3Client.send(deleteCommand);
      this.photos.delete(photoId);
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
    const photo = this.photos.get(photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }

    if (updates.title !== undefined) photo.title = updates.title;
    if (updates.description !== undefined) photo.description = updates.description;
    if (updates.tags !== undefined) photo.tags = updates.tags;

    this.photos.set(photoId, photo);
    return photo;
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
    const userPhotos = await this.getUserPhotos(userId);

    return {
      totalPhotos: userPhotos.length,
      totalSize: userPhotos.reduce((sum, photo) => sum + photo.size, 0),
      archived: userPhotos.filter(p => p.status === PhotoStatus.ARCHIVED).length,
      restoring: userPhotos.filter(p =>
        p.status === PhotoStatus.RESTORING ||
        p.status === PhotoStatus.RESTORE_REQUESTED
      ).length,
      restored: userPhotos.filter(p => p.status === PhotoStatus.RESTORED).length,
    };
  }
}
