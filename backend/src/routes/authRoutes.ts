/**
 * 認証ルート
 * OAuth 2.0認証フロー（Google/LINE）とトークン管理
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import passport from '../config/passport';
import { AuthService, JwtPayload } from '../services/AuthService';
import { verifyAppleIdentityToken } from '../services/AppleAuthService';
import { authenticateJWT } from '../middleware/auth';
import pool from '../db';

const router = express.Router();
const authService = new AuthService();

const AUTH_CODE_TTL_MS = 2 * 60 * 1000; // 2分

/** iOSアプリのコールバックURLスキーム（固定・任意URLへのリダイレクトは許可しない） */
const IOS_CALLBACK_URL = 'glaciervault://auth/callback';

/**
 * OAuth開始前にPKCEのcode_challenge（S256）とクライアント種別をセッションに保持する。
 * ネイティブアプリ（ASWebAuthenticationSession）はcode_verifierを保持し、
 * /token交換時に検証される。Webフロントエンドはchallengeなしでも可。
 */
const captureCodeChallenge = (req: Request, _res: Response, next: NextFunction) => {
  const challenge = req.query.code_challenge;
  if (typeof challenge === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
    (req.session as any).codeChallenge = challenge;
  }
  if (req.query.client === 'ios') {
    (req.session as any).oauthClient = 'ios';
  }
  next();
};

/**
 * 認可コードを発行してクライアントへリダイレクトする。
 * トークン本体をURLに載せない（ログ・ブラウザ履歴への漏洩対策）。
 * iOSクライアントはPKCE必須（code_challengeなしでは発行しない）。
 */
const issueAuthCodeAndRedirect = async (req: Request, res: Response, payload: JwtPayload) => {
  const code = uuidv4();
  const codeChallenge = (req.session as any)?.codeChallenge ?? null;
  const isIos = (req.session as any)?.oauthClient === 'ios';
  if (req.session) {
    delete (req.session as any).codeChallenge;
    delete (req.session as any).oauthClient;
  }

  if (isIos && !codeChallenge) {
    res.status(400).json({ error: 'BadRequest', message: 'code_challenge is required for iOS client' });
    return;
  }

  await pool.query('DELETE FROM auth_codes WHERE expires_at < $1', [Date.now()]);
  await pool.query(
    'INSERT INTO auth_codes (code, payload, code_challenge, expires_at) VALUES ($1, $2, $3, $4)',
    [code, JSON.stringify(payload), codeChallenge, Date.now() + AUTH_CODE_TTL_MS]
  );

  if (isIos) {
    res.redirect(`${IOS_CALLBACK_URL}?code=${code}`);
    return;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
};

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
  captureCodeChallenge,
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

      await issueAuthCodeAndRedirect(req, res, {
        userId: user.userId,
        email: user.email,
        provider: 'google',
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
      });
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
  captureCodeChallenge,
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

      await issueAuthCodeAndRedirect(req, res, {
        userId: user.userId,
        email: user.email,
        provider: 'line',
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
      });
    } catch (error) {
      console.error('LINE callback error:', error);
      res.redirect('/auth/failure');
    }
  }
);

// ============================================================
// Sign in with Apple（ネイティブ）
// ============================================================

/**
 * iOSネイティブのSign in with Apple。
 * ASAuthorizationAppleIDCredential の identityToken を検証してトークンを発行する。
 * POST /api/auth/apple
 * Body: { identityToken: string, fullName?: string }
 */
router.post('/apple', async (req: Request, res: Response) => {
  try {
    const { identityToken, fullName } = req.body;

    if (!identityToken || typeof identityToken !== 'string') {
      res.status(400).json({ error: 'BadRequest', message: 'identityToken is required' });
      return;
    }

    const identity = await verifyAppleIdentityToken(identityToken);
    const userId = `apple_${identity.sub}`;
    // Appleはメールを初回のみ返す（メール非公開設定ではリレーアドレス）
    const email = identity.email || `${userId}@privaterelay.invalid`;
    const displayName =
      typeof fullName === 'string' && fullName.trim() ? fullName.trim() : email.split('@')[0];

    await upsertUser(
      { userId, email, displayName, id: identity.sub },
      'apple'
    );

    const payload: JwtPayload = {
      userId,
      email,
      provider: 'apple',
      displayName,
    };
    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = await authService.generateRefreshToken(userId);

    res.json({ accessToken, refreshToken });
  } catch (error: any) {
    console.error('Apple sign-in error:', error.message);
    res.status(401).json({ error: 'Unauthorized', message: 'Apple sign-in failed' });
  }
});

// ============================================================
// トークン管理
// ============================================================

/**
 * 認可コード→トークン交換（PKCE対応）
 * POST /api/auth/token
 * Body: { code: string, code_verifier?: string }
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { code, code_verifier: codeVerifier } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'BadRequest', message: 'code is required' });
      return;
    }

    const result = await pool.query(
      'UPDATE auth_codes SET used = true WHERE code = $1 AND used = false AND expires_at > $2 RETURNING payload, code_challenge',
      [code, Date.now()]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired code' });
      return;
    }

    const { payload, code_challenge: codeChallenge } = result.rows[0];

    if (codeChallenge) {
      const derived = codeVerifier
        ? crypto.createHash('sha256').update(codeVerifier).digest('base64url')
        : null;
      if (!derived || derived !== codeChallenge) {
        res.status(401).json({ error: 'Unauthorized', message: 'PKCE verification failed' });
        return;
      }
    }

    const jwtPayload: JwtPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const accessToken = authService.generateAccessToken(jwtPayload);
    const refreshToken = await authService.generateRefreshToken(jwtPayload.userId);

    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Token exchange failed' });
  }
});

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
