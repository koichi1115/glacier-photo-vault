import express, { Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { billingService } from '../services/BillingService';
import { stripeService } from '../services/StripeService';
import { TIERS, getTier } from '../config/tiers';

const router = express.Router();

/**
 * GET /api/billing/tiers
 * 料金ティア一覧（認証不要・料金表表示用）
 */
router.get('/tiers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    tiers: Object.values(TIERS).map((t) => ({
      id: t.id,
      name: t.name,
      priceJpy: t.priceJpy,
      storageLimitBytes: t.storageLimitBytes,
    })),
  });
});

/**
 * POST /api/billing/setup-intent
 * Create SetupIntent for card registration
 */
router.post('/setup-intent', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await billingService.initializeSubscription(userId);

    res.json({
      success: true,
      clientSecret: result.clientSecret,
      customerId: result.customerId,
    });
  } catch (error: any) {
    console.error('Setup intent error:', error);
    res.status(500).json({ error: error.message || 'Failed to create setup intent' });
  }
});

/**
 * POST /api/billing/confirm-card
 * Confirm card and start 30-day trial
 */
router.post('/confirm-card', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { paymentMethodId, couponCode, tier } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'paymentMethodId is required' });
    }
    if (tier && !getTier(tier)) {
      return res.status(400).json({ error: `Unknown tier: ${tier}` });
    }

    const subscription = await billingService.confirmCardAndStartTrial(
      userId,
      paymentMethodId,
      couponCode,
      tier
    );

    res.json({
      success: true,
      subscription: {
        status: subscription.status,
        tier: subscription.tier,
        storageLimitBytes: subscription.storageLimitBytes,
        trialEnd: subscription.trialEnd,
      },
    });
  } catch (error: any) {
    console.error('Confirm card error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm card' });
  }
});

/**
 * GET /api/billing/subscription
 * Get current subscription status
 */
router.get('/subscription', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const subscription = await billingService.getSubscription(userId);

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        hasSubscription: false,
      });
    }

    const validationResult = await billingService.hasValidSubscription(userId);

    res.json({
      success: true,
      subscription: {
        status: subscription.status,
        platform: subscription.platform,
        tier: subscription.tier,
        storageLimitBytes: subscription.storageLimitBytes,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
      },
      hasSubscription: true,
      isValid: validationResult.valid,
      trialDaysRemaining: validationResult.trialDaysRemaining,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
});

/**
 * POST /api/billing/coupon/validate
 * Validate a coupon code
 */
router.post('/coupon/validate', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const coupon = await stripeService.validateCoupon(code);

    if (!coupon) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid or expired coupon code',
      });
    }

    res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        discountAmount: coupon.discountAmount,
      },
    });
  } catch (error: any) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate coupon' });
  }
});

/**
 * POST /api/billing/apple/transaction
 * StoreKit 2の署名付きトランザクションを検証してサブスクリプションを同期
 * Body: { signedTransaction: string }
 */
router.post('/apple/transaction', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { signedTransaction } = req.body;
    if (!signedTransaction || typeof signedTransaction !== 'string') {
      return res.status(400).json({ error: 'BadRequest', message: 'signedTransaction is required' });
    }

    const { verifySignedTransaction, syncAppleSubscription } = await import(
      '../services/AppleTransactionService'
    );
    const payload = await verifySignedTransaction(signedTransaction);
    const subscription = await syncAppleSubscription(req.user!.userId, payload);

    res.json({
      success: true,
      subscription: {
        status: subscription.status,
        platform: subscription.platform,
        tier: subscription.tier,
        storageLimitBytes: subscription.storageLimitBytes,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error: any) {
    console.error('Apple transaction sync error:', error.message);
    res.status(400).json({ error: 'InvalidTransaction', message: error.message });
  }
});

/**
 * POST /api/billing/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    await billingService.cancelSubscription(userId);

    res.json({
      success: true,
      message: 'Subscription canceled successfully',
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

export default router;
