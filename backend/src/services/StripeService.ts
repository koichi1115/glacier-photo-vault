import Stripe from 'stripe';
import pool from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  trialStart: number | null;
  trialEnd: number | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  canceledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Coupon {
  id: string;
  code: string;
  stripeCouponId: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  validUntil: number | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  createdAt: number;
}

export class StripeService {
  private stripe: Stripe;
  private productId: string | null = null;

  constructor() {
    this.stripe = stripe;
  }

  /**
   * Get or create the Glacier Photo Vault product
   */
  private async getOrCreateProduct(): Promise<string> {
    if (this.productId) {
      return this.productId;
    }

    // Search for existing product
    const products = await this.stripe.products.list({
      limit: 100,
    });

    const existingProduct = products.data.find(
      (p) => p.name === 'Glacier Photo Vault ストレージ' && p.active
    );

    if (existingProduct) {
      this.productId = existingProduct.id;
      return this.productId;
    }

    // Create new product
    const product = await this.stripe.products.create({
      name: 'Glacier Photo Vault ストレージ',
      description: '超低コスト写真保管サービス - 従量課金 ¥10/GB/月',
    });

    this.productId = product.id;
    return this.productId;
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(userId: string, email: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });
    return customer.id;
  }

  /**
   * Create a SetupIntent for collecting card info
   */
  async createSetupIntent(customerId: string): Promise<{
    clientSecret: string;
    setupIntentId: string;
  }> {
    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * Attach a payment method to customer and set as default
   */
  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  /**
   * Create a subscription with trial period
   */
  async createSubscription(
    customerId: string,
    trialDays: number = 30,
    couponId?: string
  ): Promise<Stripe.Subscription> {
    // Get or create product first
    const productId = await this.getOrCreateProduct();

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [
        {
          // Usage-based pricing - we'll add invoice items for storage usage
          price_data: {
            currency: 'jpy',
            product: productId, // Use product ID instead of product_data
            recurring: {
              interval: 'month',
            },
            unit_amount: 0, // Base is 0, usage charges added separately
          },
        },
      ],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    };

    if (couponId) {
      subscriptionParams.coupon = couponId;
    }

    return await this.stripe.subscriptions.create(subscriptionParams);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Add usage charges to a customer's next invoice
   */
  async addUsageCharge(
    customerId: string,
    storageGB: number,
    pricePerGB: number = 10
  ): Promise<Stripe.InvoiceItem> {
    const amount = Math.ceil(storageGB * pricePerGB);

    return await this.stripe.invoiceItems.create({
      customer: customerId,
      amount,
      currency: 'jpy',
      description: `ストレージ使用料 ${storageGB.toFixed(2)}GB × ¥${pricePerGB}/GB`,
    });
  }

  /**
   * Validate a coupon code
   */
  async validateCoupon(code: string): Promise<Coupon | null> {
    const result = await pool.query(`
      SELECT
        id, code, stripe_coupon_id, discount_percent, discount_amount,
        valid_until, max_uses, current_uses, is_active, created_at
      FROM coupons
      WHERE code = $1 AND is_active = true
    `, [code.toUpperCase()]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const coupon: Coupon = {
      id: row.id,
      code: row.code,
      stripeCouponId: row.stripe_coupon_id,
      discountPercent: row.discount_percent,
      discountAmount: row.discount_amount,
      validUntil: row.valid_until,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      isActive: row.is_active,
      createdAt: row.created_at,
    };

    // Check validity
    if (coupon.validUntil && Date.now() > coupon.validUntil) {
      return null;
    }
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return null;
    }

    return coupon;
  }

  /**
   * Increment coupon usage count
   */
  async incrementCouponUsage(couponId: string): Promise<void> {
    await pool.query(`
      UPDATE coupons
      SET current_uses = current_uses + 1
      WHERE id = $1
    `, [couponId]);
  }

  /**
   * Create or get Stripe coupon
   */
  async getOrCreateStripeCoupon(coupon: Coupon): Promise<string> {
    if (coupon.stripeCouponId) {
      return coupon.stripeCouponId;
    }

    const stripeCouponParams: Stripe.CouponCreateParams = {
      currency: 'jpy',
      duration: 'forever',
    };

    if (coupon.discountPercent) {
      stripeCouponParams.percent_off = coupon.discountPercent;
    } else if (coupon.discountAmount) {
      stripeCouponParams.amount_off = coupon.discountAmount;
    }

    const stripeCoupon = await this.stripe.coupons.create(stripeCouponParams);

    // Store the Stripe coupon ID
    await pool.query(`
      UPDATE coupons
      SET stripe_coupon_id = $1
      WHERE id = $2
    `, [stripeCoupon.id, coupon.id]);

    return stripeCoupon.id;
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  }
}

export const stripeService = new StripeService();
