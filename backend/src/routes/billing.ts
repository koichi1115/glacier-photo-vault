/**
 * Billing Routes
 * 支払い管理API
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticateJWT } from '../middleware/auth';
import stripeService from '../services/StripeService';
import pool from '../db';

const router = Router();

/**
 * POST /api/billing/setup-intent
 * 支払い方法登録用のSetupIntentを作成
 */
router.post('/setup-intent', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const name = req.user!.name;

    const { clientSecret, customerId } = await stripeService.createSetupIntent(userId, email);

    res.json({
      clientSecret,
      customerId,
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

/**
 * POST /api/billing/payment-method
 * 支払い方法を登録
 */
router.post(
  '/payment-method',
  authenticateJWT,
  body('paymentMethodId').isString().notEmpty(),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { paymentMethodId } = req.body;

      await stripeService.attachPaymentMethod(userId, paymentMethodId);

      res.json({
        success: true,
        message: 'Payment method attached successfully',
      });
    } catch (error) {
      console.error('Error attaching payment method:', error);
      res.status(500).json({ error: 'Failed to attach payment method' });
    }
  }
);

/**
 * GET /api/billing/payment-method
 * 登録済みの支払い方法を取得
 */
router.get('/payment-method', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT card_brand, card_last4, is_default, created_at, updated_at
       FROM payment_methods
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ hasPaymentMethod: false });
    }

    res.json({
      hasPaymentMethod: true,
      paymentMethod: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching payment method:', error);
    res.status(500).json({ error: 'Failed to fetch payment method' });
  }
});

/**
 * DELETE /api/billing/payment-method
 * 支払い方法を削除
 */
router.delete('/payment-method', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user!.id;

    await stripeService.detachPaymentMethod(userId);

    res.json({
      success: true,
      message: 'Payment method detached successfully',
    });
  } catch (error) {
    console.error('Error detaching payment method:', error);
    res.status(500).json({ error: 'Failed to detach payment method' });
  }
});

/**
 * GET /api/billing/usage
 * 現在のストレージ使用量を取得
 */
router.get('/usage', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user!.id;

    // 最新の使用量を取得
    const usageResult = await pool.query(
      `SELECT storage_bytes, file_count, date, calculated_cost
       FROM storage_usage_daily
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT 1`,
      [userId]
    );

    // ユーザー情報を取得
    const userResult = await pool.query(
      `SELECT storage_limit_bytes, has_payment_method, payment_status
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const usage = usageResult.rows[0] || {
      storage_bytes: 0,
      file_count: 0,
      date: new Date().toISOString().slice(0, 10),
      calculated_cost: 0,
    };

    const user = userResult.rows[0] || {
      storage_limit_bytes: 104857600, // 100MB
      has_payment_method: false,
      payment_status: 'good',
    };

    res.json({
      currentUsage: {
        storageBytes: parseInt(usage.storage_bytes),
        fileCount: usage.file_count,
        lastUpdated: usage.date,
      },
      limits: {
        storageLimitBytes: parseInt(user.storage_limit_bytes),
        hasPaymentMethod: user.has_payment_method,
      },
      status: {
        paymentStatus: user.payment_status,
      },
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/billing/estimate
 * 今月の予想請求額を取得
 */
router.get('/estimate', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 今月の日次使用量を集計
    const result = await pool.query(
      `SELECT SUM(calculated_cost) as total_storage_cost
       FROM storage_usage_daily
       WHERE user_id = $1 AND date >= $2`,
      [userId, firstDayOfMonth.toISOString().slice(0, 10)]
    );

    // 今月のAPI使用料を集計
    const apiResult = await pool.query(
      `SELECT SUM(cost) as total_api_cost
       FROM usage_logs
       WHERE user_id = $1 AND created_at >= $2`,
      [userId, firstDayOfMonth.getTime()]
    );

    const storageCost = parseFloat(result.rows[0]?.total_storage_cost || '0');
    const apiCost = parseFloat(apiResult.rows[0]?.total_api_cost || '0');

    res.json({
      billingPeriod: {
        start: firstDayOfMonth.toISOString().slice(0, 10),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      },
      estimate: {
        storageCost: Math.round(storageCost * 100) / 100,
        apiCost: Math.round(apiCost * 100) / 100,
        totalAmount: Math.round((storageCost + apiCost) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching estimate:', error);
    res.status(500).json({ error: 'Failed to fetch estimate' });
  }
});

/**
 * GET /api/billing/invoices
 * 請求履歴を取得
 */
router.get(
  '/invoices',
  authenticateJWT,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await pool.query(
        `SELECT
          id, stripe_invoice_id, billing_period_start, billing_period_end,
          storage_cost, restore_cost, api_cost, total_amount,
          status, paid_at, created_at
         FROM invoices
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM invoices WHERE user_id = $1',
        [userId]
      );

      res.json({
        invoices: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  }
);

/**
 * POST /api/billing/webhook
 * Stripe Webhookエンドポイント
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  try {
    await stripeService.handleWebhook(signature, JSON.stringify(req.body));
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
});

export default router;