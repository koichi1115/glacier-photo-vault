/**
 * プッシュ通知用デバイストークンの登録・削除
 */

import express, { Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import pool from '../db';

const router = express.Router();

/**
 * POST /api/devices
 * Body: { token: string, platform?: 'ios' }
 */
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string' || !/^[a-fA-F0-9]{16,200}$/.test(token)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid device token' });
    }

    await pool.query(
      `INSERT INTO device_tokens (token, user_id, platform, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET user_id = $2, platform = $3`,
      [token, req.user!.userId, platform === 'ios' ? 'ios' : 'ios', Date.now()]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to register device' });
  }
});

/**
 * DELETE /api/devices/:token — 自分のトークンのみ削除可
 */
router.delete('/:token', authenticateJWT, async (req: Request, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM device_tokens WHERE token = $1 AND user_id = $2',
      [req.params.token, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove device' });
  }
});

export default router;
