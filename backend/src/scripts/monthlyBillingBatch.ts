/**
 * Monthly Billing Batch
 * 月次請求バッチ
 *
 * 実行方法: npm run batch:monthly
 * Cronジョブで毎月1日 AM 2:00 に実行することを推奨
 */

import '../env';
import { initDb } from '../db';
import usageTracker from '../services/UsageTracker';

async function main() {
  console.log('========================================');
  console.log('Monthly Billing Batch Started');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // データベース初期化
    await initDb();
    console.log('✓ Database initialized');

    // 月次請求を実行
    await usageTracker.executeMonthlyBilling();
    console.log('✓ Monthly billing executed successfully');

    console.log('========================================');
    console.log('Monthly Billing Batch Completed Successfully');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('Monthly Billing Batch Failed');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  }
}

main();
