/**
 * 認証サービス
 * JWT（JSON Web Token）の生成・検証を行う
 * RS256アルゴリズムを使用（非対称鍵暗号）
 */

import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// JWTペイロード型定義
export interface JwtPayload {
  userId: string;
  email: string;
  provider: 'google' | 'line';
  iat?: number; // Issued At
  exp?: number; // Expiration Time
}

// リフレッシュトークンペイロード型定義
export interface RefreshTokenPayload {
  userId: string;
  tokenId: string; // トークンの一意識別子
  iat?: number;
  exp?: number;
}

export class AuthService {
  private privateKey: string;
  private publicKey: string;
  private refreshTokens: Map<string, { userId: string; expiresAt: number }>; // 本番環境ではRedisなど使用

  constructor() {
    // RSA鍵の読み込み
    const keysDir = path.join(__dirname, '..', '..', 'keys');
    this.privateKey = fs.readFileSync(path.join(keysDir, 'private.pem'), 'utf-8');
    this.publicKey = fs.readFileSync(path.join(keysDir, 'public.pem'), 'utf-8');
    this.refreshTokens = new Map();

    console.log('✅ AuthService initialized with RS256 keys');
  }

  /**
   * アクセストークンを生成（1時間有効）
   */
  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: '1h', // 1時間
    });
  }

  /**
   * リフレッシュトークンを生成（7日間有効）
   */
  generateRefreshToken(userId: string): string {
    const tokenId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7日後

    const payload: RefreshTokenPayload = {
      userId,
      tokenId,
    };

    const token = jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: '7d', // 7日間
    });

    // リフレッシュトークンをストアに保存（本番環境ではRedisを使用）
    this.refreshTokens.set(tokenId, { userId, expiresAt });

    return token;
  }

  /**
   * アクセストークンを検証
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * リフレッシュトークンを検証
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as RefreshTokenPayload;

      // トークンストアに存在するか確認
      const storedToken = this.refreshTokens.get(decoded.tokenId);
      if (!storedToken) {
        throw new Error('Refresh token not found');
      }

      // 有効期限チェック
      if (storedToken.expiresAt < Date.now()) {
        this.refreshTokens.delete(decoded.tokenId);
        throw new Error('Refresh token expired');
      }

      // userIdが一致するか確認
      if (storedToken.userId !== decoded.userId) {
        throw new Error('Invalid refresh token');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * リフレッシュトークンを無効化（ログアウト時）
   */
  revokeRefreshToken(token: string): void {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as RefreshTokenPayload;

      this.refreshTokens.delete(decoded.tokenId);
      console.log(`🔒 Refresh token revoked: ${decoded.tokenId}`);
    } catch (error) {
      // トークンが無効でも特にエラーにしない
      console.warn('Failed to revoke refresh token:', error);
    }
  }

  /**
   * 期限切れリフレッシュトークンのクリーンアップ
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenId, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now) {
        this.refreshTokens.delete(tokenId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired refresh tokens`);
    }
  }
}

// シングルトンインスタンス
export const authService = new AuthService();

// 1時間ごとに期限切れトークンをクリーンアップ
setInterval(() => {
  authService.cleanupExpiredTokens();
}, 60 * 60 * 1000);
