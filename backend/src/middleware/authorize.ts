/**
 * 認可ミドルウェア
 * ユーザーが自分のリソースにのみアクセスできることを確認
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 所有者確認ミドルウェア
 * パラメータのuserIdとJWTのuserIdが一致するか確認
 */
export const authorizeOwner = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // JWT認証が必須（authenticateJWTミドルウェアの後に使用）
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // パラメータまたはボディからuserIdを取得
    const targetUserId = req.params.userId || req.body.userId;

    if (!targetUserId) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'userId parameter is required',
      });
      return;
    }

    // JWTのuserIdと一致するか確認
    if (req.user.userId !== targetUserId) {
      console.warn(
        `⚠️  Authorization failed: User ${req.user.userId} attempted to access resources of user ${targetUserId}`
      );

      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    // 認可成功
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Authorization check failed',
    });
  }
};

/**
 * リソース所有者確認ミドルウェア（photoId用）
 * photoIdに対応する写真の所有者とJWTのuserIdが一致するか確認
 */
export const authorizePhotoOwner = (photoService: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const photoId = req.params.photoId || req.body.photoId;

      if (!photoId) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'photoId parameter is required',
        });
        return;
      }

      // 写真のメタデータを取得
      const photo = await photoService.getPhoto(photoId);

      if (!photo) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Photo not found',
        });
        return;
      }

      // 写真の所有者とJWTのuserIdが一致するか確認
      if (photo.userId !== req.user.userId) {
        console.warn(
          `⚠️  Authorization failed: User ${req.user.userId} attempted to access photo ${photoId} owned by ${photo.userId}`
        );

        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to access this photo',
        });
        return;
      }

      // 認可成功
      next();
    } catch (error) {
      console.error('Photo authorization error:', error);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Authorization check failed',
      });
    }
  };
};
