/**
 * サブスクリプション必須ミドルウェア
 * トライアル中または有効なサブスクリプションがない場合はアクセスを拒否
 */

import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/BillingService';

/**
 * サブスクリプション必須ミドルウェア
 * - トライアル中: 通過（残り日数をレスポンスヘッダーに追加）
 * - アクティブ: 通過
 * - それ以外: 403エラー
 */
export const requireSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const result = await billingService.hasValidSubscription(req.user.userId);

    if (!result.valid) {
      res.status(403).json({
        error: result.message || 'SUBSCRIPTION_REQUIRED',
        status: result.status,
        message: getErrorMessage(result.message || 'SUBSCRIPTION_REQUIRED'),
      });
      return;
    }

    // Add subscription info to response headers for frontend
    if (result.trialDaysRemaining !== undefined) {
      res.setHeader('X-Trial-Days-Remaining', result.trialDaysRemaining.toString());
    }
    res.setHeader('X-Subscription-Status', result.status);

    next();
  } catch (error: any) {
    console.error('Subscription check error:', error);
    res.status(500).json({
      error: 'SUBSCRIPTION_CHECK_FAILED',
      message: 'Failed to verify subscription status',
    });
  }
};

/**
 * オプショナルサブスクリプションチェック
 * サブスクリプションがなくても通過するが、ヘッダーに状態を追加
 */
export const optionalSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.userId) {
      const result = await billingService.hasValidSubscription(req.user.userId);

      if (result.trialDaysRemaining !== undefined) {
        res.setHeader('X-Trial-Days-Remaining', result.trialDaysRemaining.toString());
      }
      res.setHeader('X-Subscription-Status', result.status);
      res.setHeader('X-Subscription-Valid', result.valid.toString());
    }

    next();
  } catch (error) {
    // エラーがあっても次へ進む
    next();
  }
};

function getErrorMessage(code: string): string {
  switch (code) {
    case 'SUBSCRIPTION_REQUIRED':
      return 'サービスを利用するには、サブスクリプションの登録が必要です。';
    case 'TRIAL_EXPIRED':
      return 'トライアル期間が終了しました。引き続きご利用いただくには、お支払い情報をご登録ください。';
    case 'SUBSCRIPTION_INACTIVE':
      return 'サブスクリプションが無効です。お支払い状況をご確認ください。';
    default:
      return 'サブスクリプションの確認に失敗しました。';
  }
}
