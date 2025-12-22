/**
 * Usage Tracker Service
 * ストレージ使用量の追跡とコスト計算
 */

import pool from '../db';
import stripeService from './StripeService';

// 料金定数（円/GB/月）
const STORAGE_COST_PER_GB_MONTH = 10;
const DAYS_IN_MONTH = 30;

export class UsageTracker {
  /**
   * 全ユーザーの日次使用量を記録
   * 毎日 AM 0:00 に実行される想定
   */
  async recordDailyUsage(): Promise<void> {
    console.log('[UsageTracker] Starting daily usage recording...');

    try {
      const today = new Date().toISOString().slice(0, 10);

      // 全ユーザーのストレージ使用量を集計
      const result = await pool.query(`
        SELECT
          user_id,
          COALESCE(SUM(file_size), 0) as total_bytes,
          COUNT(*) as file_count
        FROM photos
        WHERE deleted_at IS NULL
        GROUP BY user_id
      `);

      console.log(`[UsageTracker] Found ${result.rows.length} users with data`);

      for (const row of result.rows) {
        const userId = row.user_id;
        const totalBytes = parseInt(row.total_bytes);
        const fileCount = parseInt(row.file_count);

        // GB単位に変換
        const totalGB = totalBytes / (1024 * 1024 * 1024);

        // 日次コストを計算（月額料金 / 30日）
        const dailyCost = (totalGB * STORAGE_COST_PER_GB_MONTH) / DAYS_IN_MONTH;

        // DBに記録（重複する場合は更新）
        await pool.query(
          `INSERT INTO storage_usage_daily (user_id, date, storage_bytes, file_count, calculated_cost, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, date)
           DO UPDATE SET
             storage_bytes = $3,
             file_count = $4,
             calculated_cost = $5`,
          [userId, today, totalBytes, fileCount, dailyCost, Date.now()]
        );

        console.log(`[UsageTracker] Recorded usage for user ${userId}: ${totalBytes} bytes (${fileCount} files), cost: ¥${dailyCost.toFixed(2)}`);
      }

      console.log('[UsageTracker] Daily usage recording completed');
    } catch (error) {
      console.error('[UsageTracker] Error recording daily usage:', error);
      throw error;
    }
  }

  /**
   * 月次請求を実行
   * 毎月1日 AM 2:00 に実行される想定
   */
  async executeMonthlyBilling(): Promise<void> {
    console.log('[UsageTracker] Starting monthly billing...');

    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      console.log(`[UsageTracker] Billing period: ${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`);

      // 支払い方法が登録されているユーザーを取得
      const usersResult = await pool.query(`
        SELECT DISTINCT pm.user_id, u.email, u.name
        FROM payment_methods pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.stripe_payment_method_id IS NOT NULL
      `);

      console.log(`[UsageTracker] Found ${usersResult.rows.length} users with payment methods`);

      for (const user of usersResult.rows) {
        const userId = user.user_id;
        const email = user.email;
        const name = user.name;

        try {
          // 前月のストレージ使用料を集計
          const storageResult = await pool.query(
            `SELECT SUM(calculated_cost) as total_cost
             FROM storage_usage_daily
             WHERE user_id = $1
               AND date >= $2
               AND date <= $3`,
            [userId, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)]
          );

          const storageCost = parseFloat(storageResult.rows[0]?.total_cost || '0');

          // 前月のAPI使用料を集計（復元、アップロードなど）
          const apiResult = await pool.query(
            `SELECT SUM(cost) as total_cost
             FROM usage_logs
             WHERE user_id = $1
               AND created_at >= $2
               AND created_at < $3`,
            [userId, periodStart.getTime(), periodEnd.getTime() + 86400000]
          );

          const apiCost = parseFloat(apiResult.rows[0]?.total_cost || '0');
          const restoreCost = 0; // TODO: 復元コストを別途集計する場合

          const totalAmount = storageCost + apiCost + restoreCost;

          // 最低請求額（1円）未満の場合はスキップ
          if (totalAmount < 1) {
            console.log(`[UsageTracker] Skipping billing for user ${userId}: amount ¥${totalAmount.toFixed(2)} < ¥1`);
            continue;
          }

          // Stripe Invoiceを作成
          console.log(`[UsageTracker] Creating invoice for user ${userId} (${email}): ¥${totalAmount.toFixed(2)}`);

          const invoiceId = await stripeService.createInvoice(
            userId,
            periodStart,
            periodEnd,
            storageCost,
            restoreCost,
            apiCost
          );

          console.log(`[UsageTracker] Invoice created for user ${userId}: ${invoiceId}`);
        } catch (error) {
          console.error(`[UsageTracker] Error billing user ${userId}:`, error);
          // 1ユーザーの請求失敗は他のユーザーに影響させない
          continue;
        }
      }

      console.log('[UsageTracker] Monthly billing completed');
    } catch (error) {
      console.error('[UsageTracker] Error in monthly billing:', error);
      throw error;
    }
  }

  /**
   * アップロードのログを記録
   */
  async logUpload(userId: string, fileSize: number, fileCount: number = 1): Promise<void> {
    // API使用料を計算（1,000リクエストあたり1円）
    const cost = fileCount / 1000;

    await pool.query(
      `INSERT INTO usage_logs (user_id, action_type, bytes_transferred, file_count, cost, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'upload', fileSize, fileCount, cost, Date.now()]
    );
  }

  /**
   * 復元のログを記録
   */
  async logRestore(userId: string, fileSize: number, restoreType: 'standard' | 'bulk'): Promise<void> {
    // 復元料金を計算（標準: 5円/GB、バルク: 1円/GB）
    const sizeGB = fileSize / (1024 * 1024 * 1024);
    const costPerGB = restoreType === 'standard' ? 5 : 1;
    const cost = sizeGB * costPerGB;

    await pool.query(
      `INSERT INTO usage_logs (user_id, action_type, bytes_transferred, file_count, cost, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'restore', fileSize, 1, cost, JSON.stringify({ restoreType }), Date.now()]
    );
  }

  /**
   * ダウンロードのログを記録（現在は無料）
   */
  async logDownload(userId: string, fileSize: number): Promise<void> {
    await pool.query(
      `INSERT INTO usage_logs (user_id, action_type, bytes_transferred, file_count, cost, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'download', fileSize, 1, 0, Date.now()]
    );
  }
}

export default new UsageTracker();
