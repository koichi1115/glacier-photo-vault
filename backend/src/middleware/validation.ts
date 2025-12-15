/**
 * 入力バリデーションミドルウェア
 * XSS、SQLインジェクション等の攻撃を防ぐ
 */

import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

/**
 * バリデーション結果のチェックミドルウェア
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request parameters',
      details: errors.array(),
    });
    return;
  }

  next();
};

/**
 * HTMLタグをサニタイズ
 */
const sanitize = (value: string): string => {
  if (typeof value !== 'string') return value;

  return sanitizeHtml(value, {
    allowedTags: [], // すべてのHTMLタグを削除
    allowedAttributes: {},
  });
};

/**
 * 写真アップロードのバリデーション
 */
export const validatePhotoUpload = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters')
    .customSanitizer(sanitize),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
    .customSanitizer(sanitize),

  body('tags')
    .optional()
    .custom((value) => {
      if (!value) return true;
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new Error('Tags must be an array');
        }
        if (parsed.length > 50) {
          throw new Error('Maximum 50 tags allowed');
        }
        for (const tag of parsed) {
          if (typeof tag !== 'string' || tag.length > 50) {
            throw new Error('Each tag must be a string with max 50 characters');
          }
        }
        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Invalid tags format');
      }
    }),

  validateRequest,
];

/**
 * 写真IDのバリデーション
 */
export const validatePhotoId = [
  param('photoId')
    .isUUID()
    .withMessage('Invalid photo ID format'),

  validateRequest,
];

/**
 * ユーザーIDのバリデーション
 */
export const validateUserId = [
  param('userId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Invalid user ID format')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('User ID must contain only alphanumeric characters, hyphens, and underscores'),

  validateRequest,
];

/**
 * リストア層のバリデーション
 */
export const validateRestoreTier = [
  body('tier')
    .optional()
    .isIn(['Standard', 'Bulk'])
    .withMessage('Tier must be either Standard or Bulk'),

  validateRequest,
];

/**
 * メタデータ更新のバリデーション
 */
export const validateMetadataUpdate = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters')
    .customSanitizer(sanitize),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
    .customSanitizer(sanitize),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags: string[]) => {
      if (tags.length > 50) {
        throw new Error('Maximum 50 tags allowed');
      }
      for (const tag of tags) {
        if (typeof tag !== 'string' || tag.length > 50) {
          throw new Error('Each tag must be a string with max 50 characters');
        }
      }
      return true;
    }),

  validateRequest,
];

/**
 * リフレッシュトークンのバリデーション
 */
export const validateRefreshToken = [
  body('refreshToken')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid token format'),

  validateRequest,
];
