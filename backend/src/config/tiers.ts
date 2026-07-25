/**
 * ストレージ課金ティア定義
 * docs/IOS_APP_PLAN.md「1. 料金ティア設計」に基づく。
 * Stripe Price ID / Apple Product ID は環境変数で注入する（未設定のティアは購入不可として扱う）。
 */

const GB = 1024 * 1024 * 1024;

export interface StorageTier {
  id: string;
  name: string;
  priceJpy: number;
  storageLimitBytes: number;
  stripePriceId?: string;
  appleProductId: string;
}

export const TIERS: Record<string, StorageTier> = {
  mini: {
    id: 'mini',
    name: 'Mini',
    priceJpy: 150,
    storageLimitBytes: 200 * GB,
    stripePriceId: process.env.STRIPE_PRICE_MINI,
    appleProductId: 'com.glacierphotovault.tier.mini',
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    priceJpy: 400,
    storageLimitBytes: 1024 * GB,
    stripePriceId: process.env.STRIPE_PRICE_STANDARD,
    appleProductId: 'com.glacierphotovault.tier.standard',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    priceJpy: 700,
    storageLimitBytes: 2 * 1024 * GB,
    stripePriceId: process.env.STRIPE_PRICE_PLUS,
    appleProductId: 'com.glacierphotovault.tier.plus',
  },
  max: {
    id: 'max',
    name: 'Max',
    priceJpy: 1500,
    storageLimitBytes: 5 * 1024 * GB,
    stripePriceId: process.env.STRIPE_PRICE_MAX,
    appleProductId: 'com.glacierphotovault.tier.max',
  },
};

/** トライアル期間中の容量上限（Miniティア相当） */
export const TRIAL_LIMIT_BYTES = TIERS.mini.storageLimitBytes;

/**
 * 復元（取り出し）の課金設定。
 * egress原価（約¥13.5/GB）があるため無料は月間契約容量の5%まで（Bulkのみ）。
 * Standard(12h)は常に有料。単価は事業判断で調整可。
 */
export const RESTORE_FREE_QUOTA_RATIO = 0.05;
export const RESTORE_PRICE_JPY_PER_GB: Record<'Bulk' | 'Standard', number> = {
  Bulk: 20,
  Standard: 30,
};

export function getTier(tierId: string | null | undefined): StorageTier | null {
  if (!tierId) return null;
  return TIERS[tierId] ?? null;
}

export function findTierByAppleProductId(productId: string): StorageTier | null {
  return Object.values(TIERS).find((t) => t.appleProductId === productId) ?? null;
}
