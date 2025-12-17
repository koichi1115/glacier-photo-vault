import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import pool from '../db';

export interface JwtPayload {
  userId: string;
  email: string;
  provider: string;
}

export class AuthService {
  private secret: string;

  constructor() {
    // Use JWT_SECRET from environment variable, or fall back to file-based keys for backward compatibility
    if (process.env.JWT_SECRET) {
      this.secret = process.env.JWT_SECRET;
      console.log('✅ JWT secret loaded from environment variable');
    } else {
      // Try to load from files (for backward compatibility)
      try {
        this.secret = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.key'), 'utf8');
        console.log('✅ JWT secret loaded from file');
      } catch (error) {
        console.warn('⚠️  JWT_SECRET not set and keys not found - using fallback secret');
        this.secret = 'dev-secret-key-change-in-production';
      }
    }

    // Clean up expired tokens on startup
    this.cleanupExpiredTokens();

    // Schedule cleanup every 24 hours
    setInterval(() => this.cleanupExpiredTokens(), 24 * 60 * 60 * 1000);
  }

  /**
   * Generate Access Token (short-lived)
   */
  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256', // Changed from RS256 to HS256 for symmetric key
      expiresIn: '1h', // 1 hour
    });
  }

  /**
   * Generate Refresh Token (long-lived)
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = uuidv4();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshToken, userId, expiresAt]
    );

    return refreshToken;
  }

  /**
   * Verify Access Token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Refresh Access Token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; newRefreshToken: string } | null> {
    const res = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const row = res.rows[0];

    if (!row) {
      return null;
    }

    if (Number(row.expires_at) < Date.now()) {
      // Expired
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return null;
    }

    // Fetch user details
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [row.user_id]);
    const user = userRes.rows[0];

    if (!user) {
      return null;
    }

    // Rotate refresh token
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const newRefreshToken = await this.generateRefreshToken(row.user_id);
    const newAccessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      provider: user.provider
    });

    return { accessToken: newAccessToken, newRefreshToken };
  }

  /**
   * Revoke Refresh Token (Logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }

  /**
   * Clean up expired tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    const now = Date.now();
    try {
      await pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [now]);
      console.log('🧹 Cleaned up expired refresh tokens');
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }

}

export const authService = new AuthService();
