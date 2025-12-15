/**
 * JWT認証ミドルウェア
 * リクエストヘッダーからJWTを検証し、ユーザー情報をreq.userに格納
 */

import { Request, Response, NextFunction } from 'express';
import { authService, JwtPayload } from '../services/AuthService';

// Expressの型拡張（req.userを使用可能にする）
declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}

/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <token> 形式のヘッダーを検証
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    // "Bearer <token>" 形式を検証
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // JWTを検証
    const payload = authService.verifyAccessToken(token);

    // req.userにペイロードを格納
    req.user = payload;

    // 次のミドルウェアへ
    next();
  } catch (error: any) {
    console.error('JWT authentication error:', error.message);

    if (error.message === 'Access token expired') {
      res.status(401).json({
        error: 'TokenExpired',
        message: 'Access token has expired. Please refresh your token.',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired access token',
    });
  }
};

/**
 * オプショナルJWT認証ミドルウェア
 * トークンがある場合は検証するが、ない場合もエラーにしない
 */
export const optionalAuthenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // トークンがなくても次へ進む
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      // 形式が不正でも次へ進む
      next();
      return;
    }

    const token = parts[1];
    const payload = authService.verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error) {
    // エラーがあっても次へ進む（トークンなしとして扱う）
    next();
  }
};
