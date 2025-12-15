import express, { Request, Response } from 'express';
import multer from 'multer';
import { GlacierPhotoService } from '../services/GlacierPhotoService';
import { authenticateJWT } from '../middleware/auth';
import { authorizeOwner, authorizePhotoOwner } from '../middleware/authorize';

const router = express.Router();
const glacierService = new GlacierPhotoService();

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images, videos, and other common file types
    const allowedMimeTypes = [
      'image/', 'video/', 'audio/',
      'application/pdf', 'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'text/'
    ];

    const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  },
});

/**
 * POST /api/photos/upload
 * Upload a photo to Glacier Deep Archive
 * 🔒 Requires: JWT authentication
 */
router.post('/upload', authenticateJWT, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ✅ SECURITY: userIdはJWTから取得（クライアントから受け取らない）
    const userId = req.user!.userId;
    const { title, description, tags, relativePath, thumbnail } = req.body;

    // Parse tags, handle empty string or undefined
    let parsedTags: string[] = [];
    if (tags && tags.trim() !== '') {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        console.error('Failed to parse tags:', tags);
        parsedTags = [];
      }
    }

    console.log('📨 Upload request:', {
      userId,
      title,
      description,
      tagsRaw: tags,
      tagsParsed: parsedTags,
      relativePath,
      hasThumbnail: !!thumbnail,
    });

    const photo = await glacierService.uploadPhoto(req.file, {
      userId, // JWTから取得したuserId
      title,
      description,
      tags: parsedTags,
      relativePath,
      thumbnail,
    });

    res.status(201).json({
      success: true,
      photo,
      message: 'Photo uploaded to Glacier Deep Archive successfully',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload photo' });
  }
});

/**
 * GET /api/photos/:photoId
 * Get photo metadata by ID
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.get('/:photoId', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const photo = await glacierService.getPhoto(photoId);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({ success: true, photo });
  } catch (error: any) {
    console.error('Get photo error:', error);
    res.status(500).json({ error: error.message || 'Failed to get photo' });
  }
});

/**
 * GET /api/photos/user/:userId
 * Get all photos for a user
 * 🔒 Requires: JWT authentication + userId ownership
 */
router.get('/user/:userId', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    // ✅ SECURITY: userIdはパラメータから取得するが、authorizeOwnerミドルウェアで検証済み
    const { userId } = req.params;
    const photos = await glacierService.getUserPhotos(userId);

    res.json({ success: true, photos, count: photos.length });
  } catch (error: any) {
    console.error('Get user photos error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user photos' });
  }
});

/**
 * POST /api/photos/:photoId/restore
 * Request photo restoration from Glacier
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.post('/:photoId/restore', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { tier = 'Standard' } = req.body;

    await glacierService.requestRestore(photoId, tier);

    const estimatedHours = tier === 'Bulk' ? 48 : 12;

    res.json({
      success: true,
      message: `Restore requested. Estimated completion: ${estimatedHours} hours`,
      tier,
      estimatedHours,
    });
  } catch (error: any) {
    console.error('Restore request error:', error);
    res.status(500).json({ error: error.message || 'Failed to request restoration' });
  }
});

/**
 * GET /api/photos/:photoId/restore/status
 * Check restore status
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.get('/:photoId/restore/status', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const status = await glacierService.checkRestoreStatus(photoId);

    res.json({ success: true, photoId, status });
  } catch (error: any) {
    console.error('Check status error:', error);
    res.status(500).json({ error: error.message || 'Failed to check restore status' });
  }
});

/**
 * GET /api/photos/:photoId/download
 * Get download URL for restored photo
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.get('/:photoId/download', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const downloadUrl = await glacierService.getDownloadUrl(photoId);

    res.json({
      success: true,
      downloadUrl,
      expiresIn: 3600, // 1 hour
    });
  } catch (error: any) {
    console.error('Download URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate download URL' });
  }
});

/**
 * PUT /api/photos/:photoId
 * Update photo metadata
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.put('/:photoId', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { title, description, tags } = req.body;

    const photo = await glacierService.updatePhotoMetadata(photoId, {
      title,
      description,
      tags,
    });

    res.json({ success: true, photo });
  } catch (error: any) {
    console.error('Update metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to update photo metadata' });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Delete photo
 * 🔒 Requires: JWT authentication + photo ownership
 */
router.delete('/:photoId', authenticateJWT, authorizePhotoOwner(glacierService), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    await glacierService.deletePhoto(photoId);

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error: any) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete photo' });
  }
});

/**
 * GET /api/photos/user/:userId/stats
 * Get storage statistics for a user
 * 🔒 Requires: JWT authentication + userId ownership
 */
router.get('/user/:userId/stats', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const stats = await glacierService.getUserStats(userId);

    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user stats' });
  }
});

/**
 * GET /api/photos/user/:userId/tags
 * Get all unique tags for a user
 * 🔒 Requires: JWT authentication + userId ownership
 */
router.get('/user/:userId/tags', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tags = await glacierService.getUserTags(userId);

    res.json({ success: true, tags });
  } catch (error: any) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user tags' });
  }
});

/**
 * GET /api/photos/user/:userId/monthly-stats
 * Get monthly storage statistics for a user (last 12 months)
 * 🔒 Requires: JWT authentication + userId ownership
 */
router.get('/user/:userId/monthly-stats', authenticateJWT, authorizeOwner, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const monthlyStats = await glacierService.getMonthlyStats(userId);

    res.json({ success: true, monthlyStats });
  } catch (error: any) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get monthly stats' });
  }
});

export default router;
