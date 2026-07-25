/**
 * Photo storage types for Glacier Deep Archive service
 */

export enum PhotoStatus {
  UPLOADING = 'uploading',
  ARCHIVED = 'archived',
  RESTORE_REQUESTED = 'restore_requested',
  RESTORING = 'restoring',
  RESTORED = 'restored',
  FAILED = 'failed'
}

export interface Photo {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  title?: string;
  description?: string;
  tags: string[];
  s3Key: string;
  glacierArchiveId?: string;
  status: PhotoStatus;
  uploadedAt: number;
  restoredUntil?: number; // Timestamp when the restored copy expires
  thumbnailUrl?: string;
}

export interface RestoreRequest {
  photoId: string;
  tier: 'Standard' | 'Bulk'; // Glacier restore tiers
  requestedAt: number;
  estimatedCompletionTime?: number;
}
