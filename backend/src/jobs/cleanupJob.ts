/**
 * Cleanup Job
 * 支払い失敗から2ヶ月経過したユーザーのデータを削除する日次ジョブ
 */

import { billingService } from '../services/BillingService';

/**
 * 未払いユーザーのデータを削除
 * 日次で実行することを想定
 */
export async function runCleanupJob(): Promise<{
  success: boolean;
  deletedCount: number;
  errors: string[];
}> {
  console.log('🧹 Starting cleanup job...');

  const errors: string[] = [];
  let deletedCount = 0;

  try {
    const usersToDelete = await billingService.getUsersScheduledForDeletion();

    console.log(`Found ${usersToDelete.length} users scheduled for deletion`);

    for (const userId of usersToDelete) {
      try {
        console.log(`Deleting data for user: ${userId}`);
        await billingService.deleteUserData(userId);
        deletedCount++;
        console.log(`✅ Successfully deleted data for user: ${userId}`);
      } catch (error: any) {
        const errorMsg = `Failed to delete data for user ${userId}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🧹 Cleanup job completed. Deleted: ${deletedCount}, Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      deletedCount,
      errors,
    };
  } catch (error: any) {
    console.error('❌ Cleanup job failed:', error);
    return {
      success: false,
      deletedCount,
      errors: [error.message],
    };
  }
}

/**
 * 定期実行のセットアップ（オプション）
 * 本番環境ではcronジョブやAWS EventBridgeで実行することを推奨
 */
export function scheduleCleanupJob(intervalHours: number = 24): NodeJS.Timeout {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`📅 Scheduling cleanup job to run every ${intervalHours} hours`);

  // 最初の実行
  runCleanupJob().catch(console.error);

  // 定期実行
  return setInterval(() => {
    runCleanupJob().catch(console.error);
  }, intervalMs);
}
