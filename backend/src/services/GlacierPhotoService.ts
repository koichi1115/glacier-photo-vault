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
  relativePath?: string;
  thumbnail?: string;
}

export class GlacierPhotoService {
  private s3Client: S3Client;
  private bucketName: string;
  private photos: Map<string, Photo>; // In-memory cache
  private userMetadataLoaded: Set<string>; // Track which users have loaded metadata

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
    this.userMetadataLoaded = new Set();
  }

  /**
   * Load user metadata from S3 JSON file
   */
  private async loadUserMetadata(userId: string): Promise<void> {
    if (this.userMetadataLoaded.has(userId)) {
      return; // Already loaded
    }

    const metadataKey = `${userId}/metadata.json`;

    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
      });

      const response = await this.s3Client.send(getCommand);
      const bodyString = await response.Body?.transformToString();

      if (bodyString) {
        const data = JSON.parse(bodyString);

        // Load all photos into memory cache
        if (data.photos) {
          Object.values(data.photos).forEach((photo: any) => {
            this.photos.set(photo.id, photo as Photo);
          });
        }
      }

      this.userMetadataLoaded.add(userId);
      console.log(`✅ Loaded metadata for user: ${userId}`);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        // No metadata file yet (new user)
        console.log(`📝 No metadata file for user: ${userId} (will create on first upload)`);
        this.userMetadataLoaded.add(userId);
      } else {
        console.error('Error loading user metadata:', error);
        throw new Error('Failed to load user metadata');
      }
    }
  }

  /**
   * Save user metadata to S3 JSON file
   */
  private async saveUserMetadata(userId: string): Promise<void> {
    const userPhotos = Array.from(this.photos.values()).filter(
      (photo) => photo.userId === userId
    );

    const metadata = {
      photos: userPhotos.reduce((acc, photo) => {
        acc[photo.id] = photo;
        return acc;
      }, {} as Record<string, Photo>),
      lastUpdated: Date.now(),
    };

    const metadataKey = `${userId}/metadata.json`;

    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: metadataKey,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
        // Use STANDARD storage for metadata (not Glacier)
        StorageClass: 'STANDARD',
        ServerSideEncryption: 'AES256', // SSE-S3 暗号化を明示的に指定
      });

      await this.s3Client.send(putCommand);
      console.log(`✅ Saved metadata for user: ${userId}`);
    } catch (error) {
      console.error('Error saving user metadata:', error);
      throw new Error('Failed to save user metadata');
    }
  }

  /**
   * Upload photo to S3 with Glacier Deep Archive storage class
   */
  async uploadPhoto(
    file: Express.Multer.File,
    metadata: PhotoMetadata
  ): Promise<Photo> {
    // Load user metadata first
    await this.loadUserMetadata(metadata.userId);

    const photoId = uuidv4();
    // Use relativePath if provided (for folder uploads), otherwise just use the filename
    const filePath = metadata.relativePath || file.originalname;
    const s3Key = `${metadata.userId}/${filePath}`;

    try {
      // Sanitize and encode metadata values for HTTP headers
      // HTTP headers only support ASCII characters, so we need to URL-encode non-ASCII characters
      const sanitize = (str: string) => {
        // First remove control characters
        const cleaned = str.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').trim();
        // Then URL-encode to handle non-ASCII characters (Japanese, etc.)
        return encodeURIComponent(cleaned);
      };

      // Prepare metadata object - only include tags if they exist
      const s3Metadata: Record<string, string> = {
        photoId,
        userId: metadata.userId,
        title: sanitize(metadata.title || ''),
        description: sanitize(metadata.description || ''),
      };

      // Only add tags if array is not empty
      if (metadata.tags && metadata.tags.length > 0) {
        const tagsString = metadata.tags.join(',');
        const encodedTags = sanitize(tagsString);
        if (encodedTags) {
          s3Metadata.tags = encodedTags;
        }
      }

      // Upload to S3 with Glacier Deep Archive storage class
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        StorageClass: 'DEEP_ARCHIVE', // Glacier Deep Archive
        Metadata: s3Metadata,
        ServerSideEncryption: 'AES256', // SSE-S3 暗号化を明示的に指定
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
        thumbnailUrl: metadata.thumbnail, // Store base64 thumbnail
      };

      this.photos.set(photoId, photo);

      // Save metadata to S3 JSON
      await this.saveUserMetadata(metadata.userId);

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
    // Load user metadata first (if not already loaded)
    await this.loadUserMetadata(userId);

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

      // Save metadata to S3 JSON
      await this.saveUserMetadata(photo.userId);
    } catch (error: any) {
      if (error.name === 'RestoreAlreadyInProgress') {
        photo.status = PhotoStatus.RESTORING;
        this.photos.set(photoId, photo);
        await this.saveUserMetadata(photo.userId);
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

      const previousStatus = photo.status;

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

      // Save metadata if status changed
      if (previousStatus !== photo.status) {
        await this.saveUserMetadata(photo.userId);
      }

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

      // Save metadata to S3 JSON
      await this.saveUserMetadata(photo.userId);
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

    // Save metadata to S3 JSON
    await this.saveUserMetadata(photo.userId);

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

  /**
   * Get all unique tags for a user
   */
  async getUserTags(userId: string): Promise<string[]> {
    const userPhotos = await this.getUserPhotos(userId);
    const tagsSet = new Set<string>();

    userPhotos.forEach(photo => {
      if (photo.tags && photo.tags.length > 0) {
        photo.tags.forEach(tag => {
          if (tag && tag.trim() !== '') {
            tagsSet.add(tag);
          }
        });
      }
    });

    return Array.from(tagsSet).sort();
  }

  /**
   * Get monthly storage statistics for a user (last 12 months)
   */
  async getMonthlyStats(userId: string): Promise<Array<{
    month: string;
    totalSize: number;
    photoCount: number;
  }>> {
    const userPhotos = await this.getUserPhotos(userId);

    // Group by month
    const monthlyData = new Map<string, { totalSize: number; photoCount: number }>();

    userPhotos.forEach(photo => {
      const date = new Date(photo.uploadedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { totalSize: 0, photoCount: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      data.totalSize += photo.size;
      data.photoCount += 1;
    });

    // Get last 12 months
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
