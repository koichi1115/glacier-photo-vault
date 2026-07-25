/**
 * 復元の無料枠・超過課金判定（authorizeRestore）のユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 外部依存をモック（Stripe SDKはAPIキー必須のため実モジュールを読み込まない）
vi.mock('../db', () => ({
  default: { query: vi.fn(), connect: vi.fn() },
}));
vi.mock('./StripeService', () => ({
  stripeService: {
    addRestoreCharge: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('./GlacierPhotoService', () => ({
  GlacierPhotoService: class {},
}));

import pool from '../db';
import { BillingService } from './BillingService';

const GB = 1024 * 1024 * 1024;
const mockQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

/** subscriptionsの行とrestore_logs集計を差し込むヘルパー */
function setupDb(subRow: Record<string, unknown> | null, usedBulkBytes: number) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM subscriptions')) {
      return { rows: subRow ? [subRow] : [], rowCount: subRow ? 1 : 0 };
    }
    if (sql.includes('FROM restore_logs')) {
      return { rows: [{ used: usedBulkBytes }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO restore_logs')) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
}

const stripeMiniSub = {
  id: 'sub1',
  user_id: 'user1',
  stripe_customer_id: 'cus_123',
  stripe_subscription_id: 'sub_stripe',
  status: 'active',
  platform: 'stripe',
  tier: 'mini',
  storage_limit_bytes: 200 * GB, // 無料枠 = 5% = 10GB
  trial_start: null,
  trial_end: null,
  current_period_start: null,
  current_period_end: null,
  canceled_at: null,
  created_at: 0,
  updated_at: 0,
};

describe('BillingService.authorizeRestore', () => {
  let billing: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    billing = new BillingService();
  });

  it('Standard復元は常に有料（¥30/GB切り上げ）', async () => {
    setupDb(stripeMiniSub, 0);
    const result = await billing.authorizeRestore('user1', 2 * GB, 'Standard');
    expect(result.allowed).toBe(true);
    expect(result.chargeJpy).toBe(60);
  });

  it('Bulk復元は月間無料枠（契約容量5%）内なら無料', async () => {
    setupDb(stripeMiniSub, 0);
    const result = await billing.authorizeRestore('user1', 5 * GB, 'Bulk');
    expect(result.allowed).toBe(true);
    expect(result.chargeJpy).toBe(0);
  });

  it('Bulk無料枠ちょうどまでは無料', async () => {
    setupDb(stripeMiniSub, 9 * GB);
    const result = await billing.authorizeRestore('user1', 1 * GB, 'Bulk');
    expect(result.allowed).toBe(true);
    expect(result.chargeJpy).toBe(0);
  });

  it('Bulk無料枠超過はStripeユーザーなら¥20/GBで許可', async () => {
    // 使用済み9GB + 今回2GB = 11GB → 超過1GB
    setupDb(stripeMiniSub, 9 * GB);
    const result = await billing.authorizeRestore('user1', 2 * GB, 'Bulk');
    expect(result.allowed).toBe(true);
    expect(result.chargeJpy).toBe(20);
  });

  it('Apple課金ユーザーは超過復元を拒否（支払い手段がないため）', async () => {
    const appleSub = { ...stripeMiniSub, platform: 'apple', stripe_customer_id: null };
    setupDb(appleSub, 9 * GB);
    const result = await billing.authorizeRestore('user1', 2 * GB, 'Bulk');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('RESTORE_PAYMENT_REQUIRED');
    expect(result.chargeJpy).toBe(20);
  });

  it('サブスク未登録（トライアル前）はMini相当の枠で判定し、超過は拒否', async () => {
    setupDb(null, 0);
    // 無料枠10GBに対し20GB → 超過。Stripe顧客もいないので拒否
    const result = await billing.authorizeRestore('user1', 20 * GB, 'Bulk');
    expect(result.allowed).toBe(false);
    expect(result.chargeJpy).toBeGreaterThan(0);
  });

  it('サブスク未登録でも枠内のBulk復元は無料で許可', async () => {
    setupDb(null, 0);
    const result = await billing.authorizeRestore('user1', 1 * GB, 'Bulk');
    expect(result.allowed).toBe(true);
    expect(result.chargeJpy).toBe(0);
  });
});
