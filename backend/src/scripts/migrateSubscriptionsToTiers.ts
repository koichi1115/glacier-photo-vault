/**
 * 既存Stripeサブスクリプション（従量制）→ ティア制への移行スクリプト
 *
 * 使い方:
 *   npx tsx src/scripts/migrateSubscriptionsToTiers.ts           # ドライラン（変更なし）
 *   npx tsx src/scripts/migrateSubscriptionsToTiers.ts --apply   # 実際に移行
 *
 * 各ユーザーの現在の使用量から最小の収まるティアを選び、
 * - Stripeサブスクリプションのitemをティア価格に差し替え（比例配分なし・次回請求から適用）
 * - DBの subscriptions.tier / storage_limit_bytes を更新
 *
 * ⚠️ 本番課金に影響するため、実行前にStripeダッシュボードでの確認と
 *    ユーザーへの料金改定告知を済ませること。
 */

import './../env';
import Stripe from 'stripe';
import pool from '../db';
import { TIERS } from '../config/tiers';
import { GlacierPhotoService } from '../services/GlacierPhotoService';

const apply = process.argv.includes('--apply');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const glacier = new GlacierPhotoService();

/** 使用量が収まる最小ティアを返す */
function pickTier(usedBytes: number) {
  const sorted = Object.values(TIERS).sort((a, b) => a.storageLimitBytes - b.storageLimitBytes);
  return sorted.find((t) => t.storageLimitBytes >= usedBytes) ?? sorted[sorted.length - 1];
}

async function main() {
  console.log(apply ? '🚀 APPLY MODE — 実際に移行します' : '🔍 DRY RUN — 変更は行いません');

  const res = await pool.query(`
    SELECT user_id, stripe_subscription_id, status, tier
    FROM subscriptions
    WHERE platform = 'stripe' AND tier IS NULL
      AND status IN ('trialing', 'active', 'past_due')
      AND stripe_subscription_id IS NOT NULL
  `);

  console.log(`対象: ${res.rows.length}件`);

  for (const row of res.rows) {
    const { user_id: userId, stripe_subscription_id: subId } = row;
    try {
      const stats = await glacier.getUserStats(userId);
      const tier = pickTier(stats.totalSize);
      const usedGB = (stats.totalSize / 1024 ** 3).toFixed(2);

      console.log(`- ${userId}: 使用量 ${usedGB}GB → ${tier.name}（¥${tier.priceJpy}/月）`);

      if (!apply) continue;

      const sub = await stripe.subscriptions.retrieve(subId);
      const itemId = sub.items.data[0]?.id;
      if (!itemId) {
        console.warn(`  ⚠️ item無し、スキップ: ${subId}`);
        continue;
      }

      const priceParams: Stripe.SubscriptionUpdateParams.Item = tier.stripePriceId
        ? { id: itemId, price: tier.stripePriceId }
        : {
            id: itemId,
            price_data: {
              currency: 'jpy',
              product: sub.items.data[0].price.product as string,
              recurring: { interval: 'month' },
              unit_amount: tier.priceJpy,
            },
          };

      await stripe.subscriptions.update(subId, {
        items: [priceParams],
        proration_behavior: 'none',
        metadata: { tier: tier.id },
      });

      await pool.query(
        `UPDATE subscriptions SET tier = $1, storage_limit_bytes = $2, updated_at = $3 WHERE user_id = $4`,
        [tier.id, tier.storageLimitBytes, Date.now(), userId]
      );

      console.log(`  ✅ 移行完了`);
    } catch (error: any) {
      console.error(`  ❌ ${userId}: ${error.message}`);
    }
  }

  await pool.end();
  console.log('完了');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
