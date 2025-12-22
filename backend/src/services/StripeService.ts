/**
 * Stripe Service
 * 支払い処理とStripe APIの統合
 */

import Stripe from 'stripe';
import pool from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export class StripeService {
  /**
   * Stripe Customerを作成または取得
   */
  async getOrCreateCustomer(userId: string, email: string, name?: string): Promise<string> {
    // 既存のCustomerを確認
    const result = await pool.query(
      'SELECT stripe_customer_id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].stripe_customer_id;
    }

    // 新規Customerを作成
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        user_id: userId,
      },
    });

    // DBに保存（payment_methodsテーブルに記録）
    const now = Date.now();
    await pool.query(
      `INSERT INTO payment_methods (user_id, stripe_customer_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         stripe_customer_id = $2,
         updated_at = $4`,
      [userId, customer.id, now, now]
    );

    return customer.id;
  }

  /**
   * Setup Intentを作成（支払い方法登録用）
   */
  async createSetupIntent(userId: string, email: string): Promise<{ clientSecret: string; customerId: string }> {
    const customerId = await this.getOrCreateCustomer(userId, email);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return {
      clientSecret: setupIntent.client_secret!,
      customerId,
    };
  }

  /**
   * 支払い方法を登録
   */
  async attachPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const result = await pool.query(
      'SELECT stripe_customer_id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customerId = result.rows[0].stripe_customer_id;

    // PaymentMethodをCustomerに紐付け
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // デフォルトの支払い方法に設定
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // PaymentMethod情報を取得
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // DBに保存
    const now = Date.now();
    await pool.query(
      `UPDATE payment_methods
       SET stripe_payment_method_id = $1,
           card_brand = $2,
           card_last4 = $3,
           is_default = true,
           updated_at = $4
       WHERE user_id = $5`,
      [
        paymentMethodId,
        paymentMethod.card?.brand || '',
        paymentMethod.card?.last4 || '',
        now,
        userId,
      ]
    );

    // usersテーブルも更新
    await pool.query(
      `UPDATE users
       SET has_payment_method = true,
           storage_limit_bytes = $1
       WHERE id = $2`,
      [1024 * 1024 * 1024 * 1024, userId] // 1TB
    );
  }

  /**
   * 支払い方法を削除
   */
  async detachPaymentMethod(userId: string): Promise<void> {
    const result = await pool.query(
      'SELECT stripe_payment_method_id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_payment_method_id) {
      return;
    }

    const paymentMethodId = result.rows[0].stripe_payment_method_id;

    // Stripeから削除
    await stripe.paymentMethods.detach(paymentMethodId);

    // DBを更新
    const now = Date.now();
    await pool.query(
      `UPDATE payment_methods
       SET stripe_payment_method_id = NULL,
           card_brand = NULL,
           card_last4 = NULL,
           updated_at = $1
       WHERE user_id = $2`,
      [now, userId]
    );

    // usersテーブルも更新
    await pool.query(
      `UPDATE users
       SET has_payment_method = false,
           storage_limit_bytes = $1
       WHERE id = $2`,
      [1024 * 1024 * 1024, userId] // 1GB
    );
  }

  /**
   * 請求書を作成
   */
  async createInvoice(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    storageCost: number,
    restoreCost: number,
    apiCost: number
  ): Promise<string> {
    const result = await pool.query(
      'SELECT stripe_customer_id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customerId = result.rows[0].stripe_customer_id;
    const totalAmount = storageCost + restoreCost + apiCost;

    // 最低請求額（1円）未満の場合はスキップ
    if (totalAmount < 1) {
      console.log(`Skipping invoice for user ${userId}: amount ${totalAmount} < 1 JPY`);
      return '';
    }

    // Stripe Invoice Itemsを作成
    if (storageCost > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(storageCost * 100), // 円 → 銭
        currency: 'jpy',
        description: `ストレージ保管料 (${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)})`,
      });
    }

    if (restoreCost > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(restoreCost * 100),
        currency: 'jpy',
        description: 'データ復元料',
      });
    }

    if (apiCost > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(apiCost * 100),
        currency: 'jpy',
        description: 'API使用料',
      });
    }

    // Invoiceを作成して自動請求
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true, // 自動的にファイナライズ
      collection_method: 'charge_automatically',
    });

    // ファイナライズして請求
    await stripe.invoices.finalizeInvoice(invoice.id);

    // DBに記録
    const now = Date.now();
    await pool.query(
      `INSERT INTO invoices (
        user_id, stripe_invoice_id, billing_period_start, billing_period_end,
        storage_cost, restore_cost, api_cost, total_amount,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userId,
        invoice.id,
        periodStart,
        periodEnd,
        storageCost,
        restoreCost,
        apiCost,
        totalAmount,
        invoice.status,
        now,
        now,
      ]
    );

    return invoice.id;
  }

  /**
   * Webhookイベントを処理
   */
  async handleWebhook(signature: string, payload: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        // 必要に応じて処理
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * 支払い成功時の処理
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const now = Date.now();

    // DBのinvoiceステータスを更新
    await pool.query(
      `UPDATE invoices
       SET status = $1, paid_at = $2, updated_at = $3
       WHERE stripe_invoice_id = $4`,
      ['paid', now, now, invoice.id]
    );

    // ユーザーのpayment_statusをgoodに戻す
    const result = await pool.query(
      'SELECT user_id FROM payment_methods WHERE stripe_customer_id = $1',
      [invoice.customer as string]
    );

    if (result.rows.length > 0) {
      await pool.query(
        `UPDATE users
         SET payment_status = $1, last_payment_failed_at = NULL
         WHERE id = $2`,
        ['good', result.rows[0].user_id]
      );
    }

    console.log(`Payment succeeded for invoice ${invoice.id}`);
  }

  /**
   * 支払い失敗時の処理
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const now = Date.now();

    // DBのinvoiceステータスを更新
    await pool.query(
      `UPDATE invoices
       SET status = $1, updated_at = $2
       WHERE stripe_invoice_id = $3`,
      ['failed', now, invoice.id]
    );

    // ユーザーのpayment_statusをpast_dueに設定
    const result = await pool.query(
      'SELECT user_id FROM payment_methods WHERE stripe_customer_id = $1',
      [invoice.customer as string]
    );

    if (result.rows.length > 0) {
      await pool.query(
        `UPDATE users
         SET payment_status = $1, last_payment_failed_at = $2
         WHERE id = $3`,
        ['past_due', now, result.rows[0].user_id]
      );
    }

    console.error(`Payment failed for invoice ${invoice.id}`);
  }
}

export default new StripeService();
