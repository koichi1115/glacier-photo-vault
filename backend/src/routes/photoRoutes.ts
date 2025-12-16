import express, { Request, Response } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { GlacierPhotoService } from '../services/GlacierPhotoService';
import { authenticateJWT } from '../middleware/auth';
import { authorizePhotoOwner, authorizeOwner } from '../middleware/authorize';
import { PhotoStatus } from '@glacier-photo-vault/shared';

const router = express.Router();
const glacierService = new GlacierPhotoService();

// S3 Client for multer-s3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bucketName = process.env.S3_BUCKET_NAME || 'glacier-photo-vault';

// Configure multer-s3 for streaming uploads
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req: any, file: any, cb: any) {
      // We can't easily access body fields here reliably because of multipart order
      // So we store minimal metadata here, and the rest in DB
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req: any, file: any, cb: any) {
      const userId = req.user?.userId || 'unknown';
      const relativePath = req.body.relativePath || file.originalname;
      // Sanitize path to prevent directory traversal or weird chars
      const safePath = relativePath.replace(/[^a-zA-Z0-9_\-\.\/]/g, '_');
      cb(null, `${userId}/${safePath}`);
    },
    // Server-side encryption
    serverSideEncryption: 'AES256',
    // Storage class
    storageClass: 'DEEP_ARCHIVE'
  } as any),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Allow images, videos, audio, pdf, zip, etc.
    if (file.mimetype.match(/^(image\/|video\/|audio\/|application\/pdf|application\/zip|application\/x-zip-compressed|multipart\/x-zip)/)) {
      cb(null, true);
    } else {
      cb(null, true); // Allow all for now, or restrict if needed
    }
  },
});

// Upload photo
router.post(
  '/upload',
  authenticateJWT,
  upload.single('photo'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user!.userId;
      const { title, description, tags, relativePath, thumbnail } = req.body;

      // Parse tags
      let parsedTags: string[] = [];
      if (typeof tags === 'string') {
        parsedTags = tags.split(',').map((t) => t.trim());
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }

      // Record metadata in DB
      // req.file is now an S3 file object from multer-s3
      const photo = await glacierService.recordUpload(req.file as Express.MulterS3.File, {
        userId,
        title,
        description,
        tags: parsedTags,
        relativePath,
        thumbnail,
      });

      res.status(201).json({
        success: true,
        photo,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload photo' });
    }
  }
);

// Get user photos
router.get('/user/:userId', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const photos = await glacierService.getUserPhotos(userId);
    res.json({ success: true, photos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
router.get('/user/:userId/stats', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const stats = await glacierService.getUserStats(userId);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user tags
router.get('/user/:userId/tags', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const tags = await glacierService.getUserTags(userId);
    res.json({ success: true, tags });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly stats
router.get('/user/:userId/monthly-stats', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const monthlyStats = await glacierService.getMonthlyStats(userId);
    res.json({ success: true, monthlyStats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request restore
router.post(
  '/:photoId/restore',
  authenticateJWT,
  authorizePhotoOwner(glacierService),
  async (req: Request, res: Response) => {
    try {
      const photoId = req.params.photoId;
      const { tier } = req.body;
      await glacierService.requestRestore(photoId, tier);

      // Calculate estimated hours
      const estimatedHours = tier === 'Bulk' ? 48 : 12;

      res.json({ success: true, estimatedHours });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Check restore status
router.get(
  '/:photoId/restore/status',
  authenticateJWT,
  authorizePhotoOwner(glacierService),
  async (req: Request, res: Response) => {
    try {
      const photoId = req.params.photoId;
      const status = await glacierService.checkRestoreStatus(photoId);
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get download URL
router.get(
  '/:photoId/download',
  authenticateJWT,
  authorizePhotoOwner(glacierService),
  async (req: Request, res: Response) => {
    try {
      const photoId = req.params.photoId;
      const downloadUrl = await glacierService.getDownloadUrl(photoId);
      res.json({ success: true, downloadUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete photo
router.delete(
  '/:photoId',
  authenticateJWT,
  authorizePhotoOwner(glacierService),
  async (req: Request, res: Response) => {
    try {
      const photoId = req.params.photoId;
      await glacierService.deletePhoto(photoId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update photo metadata
router.patch(
  '/:photoId',
  authenticateJWT,
  authorizePhotoOwner(glacierService),
  async (req: Request, res: Response) => {
    try {
      const photoId = req.params.photoId;
      const updates = req.body;
      const photo = await glacierService.updatePhotoMetadata(photoId, updates);
      res.json({ success: true, photo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
