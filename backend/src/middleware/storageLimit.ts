/**
 * Storage Limit Middleware
 * ストレージ容量制限チェック
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../db';

interface StorageCheckResult {
  currentUsage: number;
  storageLimit: number;
  hasPaymentMethod: boolean;
  paymentStatus: string;
  canUpload: boolean;
  reason?: string;
}

/**
 * ユーザーのストレージ使用量と制限を確認
 */
export async function checkStorageLimit(userId: string): Promise<StorageCheckResult> {
  // ユーザー情報を取得
  const userResult = await pool.query(
    `SELECT storage_limit_bytes, has_payment_method, payment_status
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];
  const storageLimit = parseInt(user.storage_limit_bytes);
  const hasPaymentMethod = user.has_payment_method;
  const paymentStatus = user.payment_status;

  // 現在の使用量を取得（photosテーブルから集計）
  const usageResult = await pool.query(
    `SELECT COALESCE(SUM(file_size), 0) as total_size
     FROM photos
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  const currentUsage = parseInt(usageResult.rows[0].total_size);

  // アップロード可否の判定
  let canUpload = true;
  let reason: string | undefined;

  // 1. 支払いステータスが past_due または suspended の場合
  if (paymentStatus === 'suspended') {
    canUpload = false;
    reason = 'アカウントが停止されています。支払い情報を更新してください。';
  } else if (paymentStatus === 'past_due') {
    // past_dueの場合は警告のみ（まだアップロード可能）
    console.warn(`User ${userId} has past_due payment status`);
  }

  // 2. 容量制限チェック
  if (currentUsage >= storageLimit) {
    canUpload = false;

    if (!hasPaymentMethod) {
      if (storageLimit === 104857600) { // 100MB
        reason = '無料枠（100MB）の上限に達しました。支払い方法を登録すると1GBまで利用できます。';
      } else {
        reason = `ストレージ容量の上限（${formatBytes(storageLimit)}）に達しました。支払い方法を登録してください。`;
      }
    } else {
      reason = `ストレージ容量の上限（${formatBytes(storageLimit)}）に達しました。不要なファイルを削除するか、サポートにお問い合わせください。`;
    }
  }

  return {
    currentUsage,
    storageLimit,
    hasPaymentMethod,
    paymentStatus,
    canUpload,
    reason,
  };
}

/**
 * アップロード前にストレージ容量をチェックするミドルウェア
 */
export function requireStorageLimit(requiredBytes?: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.id;
      const check = await checkStorageLimit(userId);

      // 容量チェック
      if (!check.canUpload) {
        return res.status(403).json({
          error: 'Storage limit exceeded',
          message: check.reason,
          currentUsage: check.currentUsage,
          storageLimit: check.storageLimit,
          hasPaymentMethod: check.hasPaymentMethod,
        });
      }

      // 追加予定のファイルサイズを考慮
      if (requiredBytes) {
        const projectedUsage = check.currentUsage + requiredBytes;
        if (projectedUsage > check.storageLimit) {
          return res.status(403).json({
            error: 'Storage limit would be exceeded',
            message: `このファイルをアップロードすると容量制限（${formatBytes(check.storageLimit)}）を超えてしまいます。`,
            currentUsage: check.currentUsage,
            requiredBytes,
            projectedUsage,
            storageLimit: check.storageLimit,
          });
        }
      }

      // チェック結果をリクエストに添付（後続の処理で利用可能）
      (req as any).storageCheck = check;

      next();
    } catch (error) {
      console.error('Storage limit check error:', error);
      res.status(500).json({ error: 'Failed to check storage limit' });
    }
  };
}

/**
 * 支払い方法の登録を要求するミドルウェア
 */
export function requirePaymentMethod() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.id;
      const check = await checkStorageLimit(userId);

      // 無料枠を超えている場合は支払い方法の登録を要求
      if (check.currentUsage > 104857600 && !check.hasPaymentMethod) {
        return res.status(402).json({
          error: 'Payment method required',
          message: '無料枠（100MB）を超えています。支払い方法を登録してください。',
          currentUsage: check.currentUsage,
          freeLimit: 104857600,
        });
      }

      next();
    } catch (error) {
      console.error('Payment method check error:', error);
      res.status(500).json({ error: 'Failed to check payment method' });
    }
  };
}

/**
 * バイト数を人間が読める形式にフォーマット
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}