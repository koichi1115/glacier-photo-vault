/**
 * プリサインドURLによるS3直接アップロードAPI
 *
 * フロー:
 *   POST /api/uploads/init     → 単一PUT用URL または マルチパート用URL群を発行
 *   （クライアントがS3へ直接PUT）
 *   POST /api/uploads/complete → マルチパート完了 + 検証 + DBメタデータ記録
 *   POST /api/uploads/abort    → マルチパート中断（パート掃除）
 *
 * 従来のバックエンドプロキシ方式（/api/photos/upload, 100MB上限）を置き換える。
 */

import express, { Request, Response } from 'express';
import { GlacierPhotoService } from '../services/GlacierPhotoService';
import { authenticateJWT } from '../middleware/auth';
import { requireSubscription } from '../middleware/requireSubscription';
import { getTier, TRIAL_LIMIT_BYTES } from '../config/tiers';
import pool from '../db';

const router = express.Router();
const glacierService = new GlacierPhotoService();

/** relativePath/fileName をS3キーとして安全な形に正規化する（従来ロジックと同一） */
const toSafePath = (p: string): string => p.replace(/[^a-zA-Z0-9_\-\.\/]/g, '_');

/** ユーザーの契約容量上限（bytes）。ティア未設定（トライアル等）はトライアル上限。 */
async function getStorageLimit(userId: string): Promise<number> {
  const res = await pool.query(
    'SELECT tier, storage_limit_bytes FROM subscriptions WHERE user_id = $1',
    [userId]
  );
  const row = res.rows[0];
  if (row?.storage_limit_bytes) return Number(row.storage_limit_bytes);
  const tier = getTier(row?.tier);
  return tier ? tier.storageLimitBytes : TRIAL_LIMIT_BYTES;
}

router.post(
  '/init',
  authenticateJWT,
  requireSubscription,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { fileName, relativePath, size, mimeType } = req.body;

      if (!fileName || typeof fileName !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'fileName is required' });
      }
      if (!Number.isFinite(size) || size <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'size must be a positive number' });
      }

      // 容量クォータチェック
      const [stats, limit] = await Promise.all([
        glacierService.getUserStats(userId),
        getStorageLimit(userId),
      ]);
      if (stats.totalSize + size > limit) {
        return res.status(413).json({
          error: 'QuotaExceeded',
          message: 'Storage quota exceeded for current plan',
          usedBytes: stats.totalSize,
          limitBytes: limit,
        });
      }

      const safePath = toSafePath(
        typeof relativePath === 'string' && relativePath ? relativePath : fileName
      );
      const s3Key = `${userId}/${safePath}`;

      const result = await glacierService.initDirectUpload({
        userId,
        s3Key,
        size,
        mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream',
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Upload init error:', error);
      res.status(500).json({ error: error.message || 'Failed to initialize upload' });
    }
  }
);

router.post(
  '/complete',
  authenticateJWT,
  requireSubscription,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { key, uploadId, parts, fileName, mimeType, title, description, tags, thumbnail } = req.body;

      if (!key || typeof key !== 'string' || !key.startsWith(`${userId}/`)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Invalid upload key' });
      }
      if (!fileName || typeof fileName !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'fileName is required' });
      }

      // マルチパートの場合はS3側で結合を完了させる
      if (uploadId) {
        if (!Array.isArray(parts) || parts.length === 0) {
          return res.status(400).json({ error: 'BadRequest', message: 'parts are required for multipart completion' });
        }
        await glacierService.completeMultipartUpload(
          key,
          uploadId,
          parts.map((p: any) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }))
        );
      }

      // オブジェクトの実在を検証してからメタデータを記録する
      const verified = await glacierService.verifyObject(key);
      if (!verified.exists) {
        return res.status(400).json({ error: 'BadRequest', message: 'Object not found in storage' });
      }

      let parsedTags: string[] = [];
      if (typeof tags === 'string') parsedTags = tags.split(',').map((t: string) => t.trim());
      else if (Array.isArray(tags)) parsedTags = tags.map(String);

      const photo = await glacierService.recordDirectUpload({
        userId,
        s3Key: key,
        originalName: fileName,
        mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream',
        size: verified.size,
        title,
        description,
        tags: parsedTags,
        thumbnail,
      });

      res.status(201).json({ success: true, photo });
    } catch (error: any) {
      console.error('Upload complete error:', error);
      res.status(500).json({ error: error.message || 'Failed to complete upload' });
    }
  }
);

router.post(
  '/abort',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { key, uploadId } = req.body;

      if (!key || typeof key !== 'string' || !key.startsWith(`${userId}/`)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Invalid upload key' });
      }
      if (!uploadId || typeof uploadId !== 'string') {
        return res.status(400).json({ error: 'BadRequest', message: 'uploadId is required' });
      }

      await glacierService.abortMultipartUpload(key, uploadId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Upload abort error:', error);
      res.status(500).json({ error: error.message || 'Failed to abort upload' });
    }
  }
);

export default router;
