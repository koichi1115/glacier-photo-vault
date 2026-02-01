import pool from '../db';
import { stripeService, Subscription, Coupon } from './StripeService';
import { GlacierPhotoService } from './GlacierPhotoService';

const TRIAL_DAYS = 30;
const DELETION_DELAY_DAYS = 60; // 2 months

export class BillingService {
  private glacierService: GlacierPhotoService;

  constructor() {
    this.glacierService = new GlacierPhotoService();
  }

  /**
   * Get user's subscription
   */
  async getSubscription(userId: string): Promise<Subscription | null> {
    const result = await pool.query(`
      SELECT
        id, user_id, stripe_customer_id, stripe_subscription_id,
        status, trial_start, trial_end,
        current_period_start, current_period_end,
        canceled_at, created_at, updated_at
      FROM subscriptions
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      trialStart: row.trial_start,
      trialEnd: row.trial_end,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      canceledAt: row.canceled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get user info from users table
   */
  async getUserInfo(userId: string): Promise<{ email: string | null; name: string | null } | null> {
    const result = await pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );
    if (!result.rows[0]) {
      return null;
    }
    return {
      email: result.rows[0].email || null,
      name: result.rows[0].name || null,
    };
  }

  /**
   * Start trial for a new user - creates customer and SetupIntent
   */
  async initializeSubscription(userId: string): Promise<{
    clientSecret: string;
    customerId: string;
  }> {
    const userInfo = await this.getUserInfo(userId);
    if (!userInfo) {
      throw new Error('User not found');
    }

    // Use email or generate placeholder for LINE users without email
    const email = userInfo.email || `${userId}@glacier-vault.local`;

    // Check if subscription already exists
    const existingSub = await this.getSubscription(userId);
    if (existingSub) {
      // Return existing setup intent if customer exists
      if (existingSub.stripeCustomerId) {
        const { clientSecret } = await stripeService.createSetupIntent(
          existingSub.stripeCustomerId
        );
        return { clientSecret, customerId: existingSub.stripeCustomerId };
      }
    }

    // Create Stripe customer
    const customerId = await stripeService.createCustomer(userId, email);

    // Create SetupIntent
    const { clientSecret } = await stripeService.createSetupIntent(customerId);

    // Create subscription record (pending until card confirmed)
    const now = Date.now();
    await pool.query(`
      INSERT INTO subscriptions (
        user_id, stripe_customer_id, status, created_at, updated_at
      ) VALUES ($1, $2, 'incomplete', $3, $3)
      ON CONFLICT (user_id) DO UPDATE
      SET stripe_customer_id = $2, updated_at = $3
    `, [userId, customerId, now]);

    return { clientSecret, customerId };
  }

  /**
   * Confirm card and start trial
   */
  async confirmCardAndStartTrial(
    userId: string,
    paymentMethodId: string,
    couponCode?: string
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error('Subscription not initialized');
    }

    // Attach payment method
    await stripeService.attachPaymentMethod(
      subscription.stripeCustomerId,
      paymentMethodId
    );

    // Handle coupon
    let stripeCouponId: string | undefined;
    if (couponCode) {
      const coupon = await stripeService.validateCoupon(couponCode);
      if (coupon) {
        stripeCouponId = await stripeService.getOrCreateStripeCoupon(coupon);
        await stripeService.incrementCouponUsage(coupon.id);
      }
    }

    // Create Stripe subscription with trial
    const stripeSub = await stripeService.createSubscription(
      subscription.stripeCustomerId,
      TRIAL_DAYS,
      stripeCouponId
    );

    // Update local subscription record
    const now = Date.now();
    const trialEnd = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;

    await pool.query(`
      UPDATE subscriptions
      SET
        stripe_subscription_id = $1,
        status = 'trialing',
        trial_start = $2,
        trial_end = $3,
        current_period_start = $2,
        current_period_end = $3,
        updated_at = $2
      WHERE user_id = $4
    `, [stripeSub.id, now, trialEnd, userId]);

    return (await this.getSubscription(userId))!;
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(
    stripeCustomerId: string,
    stripeSubscriptionId: string
  ): Promise<void> {
    const now = Date.now();

    // Get subscription from Stripe
    const stripeSub = await stripeService.getSubscription(stripeSubscriptionId);

    await pool.query(`
      UPDATE subscriptions
      SET
        status = 'active',
        current_period_start = $1,
        current_period_end = $2,
        updated_at = $3
      WHERE stripe_customer_id = $4
    `, [
      stripeSub.current_period_start! * 1000,
      stripeSub.current_period_end! * 1000,
      now,
      stripeCustomerId,
    ]);

    // Clear any payment failure flags
    await pool.query(`
      UPDATE users
      SET first_payment_failed_at = NULL, scheduled_deletion_at = NULL
      WHERE id = (
        SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1
      )
    `, [stripeCustomerId]);
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(stripeCustomerId: string): Promise<void> {
    const now = Date.now();
    const deletionDate = now + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000;

    await pool.query(`
      UPDATE subscriptions
      SET status = 'past_due', updated_at = $1
      WHERE stripe_customer_id = $2
    `, [now, stripeCustomerId]);

    // Set first failure date (only if not already set)
    await pool.query(`
      UPDATE users
      SET
        first_payment_failed_at = COALESCE(first_payment_failed_at, $1),
        scheduled_deletion_at = COALESCE(scheduled_deletion_at, $2)
      WHERE id = (
        SELECT user_id FROM subscriptions WHERE stripe_customer_id = $3
      )
    `, [now, deletionDate, stripeCustomerId]);
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
    const now = Date.now();

    await pool.query(`
      UPDATE subscriptions
      SET status = 'canceled', canceled_at = $1, updated_at = $1
      WHERE stripe_subscription_id = $2
    `, [now, stripeSubscriptionId]);
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.getSubscription(userId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    const now = Date.now();
    await pool.query(`
      UPDATE subscriptions
      SET status = 'canceled', canceled_at = $1, updated_at = $1
      WHERE user_id = $2
    `, [now, userId]);
  }

  /**
   * Check if user has valid subscription (trialing or active)
   */
  async hasValidSubscription(userId: string): Promise<{
    valid: boolean;
    status: string;
    trialDaysRemaining?: number;
    message?: string;
  }> {
    const subscription = await this.getSubscription(userId);

    if (!subscription) {
      return { valid: false, status: 'none', message: 'SUBSCRIPTION_REQUIRED' };
    }

    const now = Date.now();

    if (subscription.status === 'trialing') {
      if (subscription.trialEnd && now > subscription.trialEnd) {
        return { valid: false, status: 'trial_expired', message: 'TRIAL_EXPIRED' };
      }
      const daysRemaining = subscription.trialEnd
        ? Math.ceil((subscription.trialEnd - now) / (24 * 60 * 60 * 1000))
        : 0;
      return { valid: true, status: 'trialing', trialDaysRemaining: daysRemaining };
    }

    if (subscription.status === 'active') {
      return { valid: true, status: 'active' };
    }

    return { valid: false, status: subscription.status, message: 'SUBSCRIPTION_INACTIVE' };
  }

  /**
   * Calculate and add monthly usage charges
   */
  async processMonthlyBilling(userId: string): Promise<number> {
    const subscription = await this.getSubscription(userId);
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error('No subscription found');
    }

    const stats = await this.glacierService.getUserStats(userId);
    const storageGB = stats.totalSize / (1024 * 1024 * 1024);
    const cost = Math.ceil(storageGB * 10); // ¥10/GB

    if (cost > 0) {
      await stripeService.addUsageCharge(
        subscription.stripeCustomerId,
        storageGB,
        10
      );
    }

    return cost;
  }

  /**
   * Get users scheduled for deletion
   */
  async getUsersScheduledForDeletion(): Promise<string[]> {
    const now = Date.now();

    const result = await pool.query(`
      SELECT id FROM users
      WHERE scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= $1
    `, [now]);

    return result.rows.map(row => row.id);
  }

  /**
   * Delete user data (called by cleanup job)
   */
  async deleteUserData(userId: string): Promise<void> {
    // Delete S3 data
    await this.glacierService.deleteUserFolder(userId);

    // Delete from database (cascade will handle related records)
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

export const billingService = new BillingService();
