/**
 * 認証ルート
 * OAuth 2.0認証フロー（Google/LINE）とトークン管理
 */

import express, { Request, Response } from 'express';
import passport from '../config/passport';
import { authService } from '../services/AuthService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

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
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // JWTトークンを生成
      const accessToken = authService.generateAccessToken({
        userId: user.userId,
        email: user.email,
        provider: 'google',
      });

      const refreshToken = authService.generateRefreshToken(user.userId);

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
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // JWTトークンを生成
      const accessToken = authService.generateAccessToken({
        userId: user.userId,
        email: user.email,
        provider: 'line',
      });

      const refreshToken = authService.generateRefreshToken(user.userId);

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
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'refreshToken is required',
      });
      return;
    }

    // リフレッシュトークンを検証
    const payload = authService.verifyRefreshToken(refreshToken);

    // 新しいアクセストークンを生成（リフレッシュトークンは再利用）
    // 実際の本番環境では、リフレッシュトークンも定期的にローテーションすることを推奨
    const newAccessToken = authService.generateAccessToken({
      userId: payload.userId,
      email: '', // リフレッシュトークンにはemailがないため空文字
      provider: 'google', // プロバイダー情報を保持する場合は別途保存が必要
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken, // 既存のリフレッシュトークンをそのまま返す
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
router.post('/logout', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // リフレッシュトークンを無効化
      authService.revokeRefreshToken(refreshToken);
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
