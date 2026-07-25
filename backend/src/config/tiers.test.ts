import { describe, it, expect } from 'vitest';
import {
  TIERS,
  getTier,
  findTierByAppleProductId,
  TRIAL_LIMIT_BYTES,
  RESTORE_FREE_QUOTA_RATIO,
  RESTORE_PRICE_JPY_PER_GB,
} from './tiers';

const GB = 1024 * 1024 * 1024;

describe('tiers config', () => {
  it('defines 4 tiers with ascending price and capacity', () => {
    const list = Object.values(TIERS);
    expect(list).toHaveLength(4);
    const sorted = [...list].sort((a, b) => a.priceJpy - b.priceJpy);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].storageLimitBytes).toBeGreaterThan(sorted[i - 1].storageLimitBytes);
    }
  });

  it('has expected tier sizes', () => {
    expect(TIERS.mini.storageLimitBytes).toBe(200 * GB);
    expect(TIERS.standard.storageLimitBytes).toBe(1024 * GB);
    expect(TIERS.plus.storageLimitBytes).toBe(2 * 1024 * GB);
    expect(TIERS.max.storageLimitBytes).toBe(5 * 1024 * GB);
  });

  it('getTier resolves known ids and rejects unknown', () => {
    expect(getTier('mini')?.name).toBe('Mini');
    expect(getTier('plus')?.priceJpy).toBe(700);
    expect(getTier('unknown')).toBeNull();
    expect(getTier(null)).toBeNull();
    expect(getTier(undefined)).toBeNull();
  });

  it('findTierByAppleProductId maps product ids', () => {
    expect(findTierByAppleProductId('com.glacierphotovault.tier.max')?.id).toBe('max');
    expect(findTierByAppleProductId('com.example.bogus')).toBeNull();
  });

  it('trial limit equals mini tier', () => {
    expect(TRIAL_LIMIT_BYTES).toBe(TIERS.mini.storageLimitBytes);
  });

  it('restore pricing constants are sane', () => {
    expect(RESTORE_FREE_QUOTA_RATIO).toBeGreaterThan(0);
    expect(RESTORE_FREE_QUOTA_RATIO).toBeLessThan(1);
    // Standard(12h)はBulkより高い
    expect(RESTORE_PRICE_JPY_PER_GB.Standard).toBeGreaterThan(RESTORE_PRICE_JPY_PER_GB.Bulk);
  });
});
