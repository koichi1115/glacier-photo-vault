/**
 * Daily Usage Batch
 * 日次ストレージ使用量記録バッチ
 *
 * 実行方法: npm run batch:daily
 * Cronジョブで毎日 AM 0:00 に実行することを推奨
 */

import '../env';
import { initDb } from '../db';
import usageTracker from '../services/UsageTracker';

async function main() {
  console.log('========================================');
  console.log('Daily Usage Batch Started');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // データベース初期化
    await initDb();
    console.log('✓ Database initialized');

    // 日次使用量を記録
    await usageTracker.recordDailyUsage();
    console.log('✓ Daily usage recorded successfully');

    console.log('========================================');
    console.log('Daily Usage Batch Completed Successfully');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('Daily Usage Batch Failed');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  }
}

main();
