/**
 * 認証ルート
 * OAuth 2.0認証フロー（Google/LINE）とトークン管理
 */

import express, { Request, Response } from 'express';
import passport from '../config/passport';
import { AuthService } from '../services/AuthService';
import { authenticateJWT } from '../middleware/auth';
import pool from '../db';

const router = express.Router();
const authService = new AuthService();

// Helper to upsert user
const upsertUser = async (user: any, provider: string) => {
  const now = Date.now();
  const query = `
    INSERT INTO users (id, email, name, provider, provider_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(id) DO UPDATE SET
      email = $2,
      name = $3,
      provider = $4,
      provider_id = $5
  `;

  await pool.query(query, [
    user.userId,
    user.email,
    user.displayName || user.email.split('@')[0],
    provider,
    user.id || user.userId, // passport profile id
    now
  ]);
};

// ============================================================
// Google OAuth 2.0
// ============================================================

/**
 * Google OAuth開始
 * GET /api/auth/google
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false, // JWTを使うのでセッション不要
  })
);

/**
 * Google OAuthコールバック
 * GET /api/auth/google/callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/auth/failure',
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // Save user to DB
      await upsertUser(user, 'google');

      // JWTトークンを生成
      const accessToken = authService.generateAccessToken({
        userId: user.userId,
        email: user.email,
        provider: 'google',
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
      });

      const refreshToken = await authService.generateRefreshToken(user.userId);

      // フロントエンドにリダイレクト（トークンをクエリパラメータで渡す）
      // 本番環境では、より安全な方法（HTTPOnly Cookie等）を検討
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/auth/failure');
    }
  }
);

// ============================================================
// LINE OAuth 2.0
// ============================================================

/**
 * LINE OAuth開始
 * GET /api/auth/line
 */
router.get(
  '/line',
  passport.authenticate('line', {
    session: false,
  })
);

/**
 * LINE OAuthコールバック
 * GET /api/auth/line/callback
 */
router.get(
  '/line/callback',
  passport.authenticate('line', {
    session: false,
    failureRedirect: '/auth/failure',
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // Save user to DB
      await upsertUser(user, 'line');

      // JWTトークンを生成
      const accessToken = authService.generateAccessToken({
        userId: user.userId,
        email: user.email,
        provider: 'line',
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
      });

      const refreshToken = await authService.generateRefreshToken(user.userId);

      // フロントエンドにリダイレクト
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`
      );
    } catch (error) {
      console.error('LINE callback error:', error);
      res.redirect('/auth/failure');
    }
  }
);

// ============================================================
// トークン管理
// ============================================================

/**
 * トークンリフレッシュ
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'refreshToken is required',
      });
      return;
    }

    // Use new refresh logic which handles verification, rotation, and DB check
    const result = await authService.refreshAccessToken(refreshToken);

    if (!result) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
      return;
    }

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.newRefreshToken,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error.message);

    res.status(401).json({
      error: 'Unauthorized',
      message: error.message || 'Invalid refresh token',
    });
  }
});

/**
 * ログアウト
 * POST /api/auth/logout
 * Body: { refreshToken: string }
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // リフレッシュトークンを無効化
      await authService.revokeRefreshToken(refreshToken);
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Logout failed',
    });
  }
});

/**
 * 現在のユーザー情報取得
 * GET /api/auth/me
 * Headers: Authorization: Bearer <access_token>
 */
router.get('/me', authenticateJWT, (req: Request, res: Response) => {
  res.json({
    user: req.user,
  });
});

/**
 * 認証失敗ページ
 * GET /auth/failure
 */
router.get('/failure', (req: Request, res: Response) => {
  res.status(401).json({
    error: 'AuthenticationFailed',
    message: 'OAuth authentication failed',
  });
});

export default router;
