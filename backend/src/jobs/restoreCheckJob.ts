/**
 * 復元状態ポーリングジョブ
 *
 * 復元中（restore_requested / restoring）の写真を定期的にS3へ問い合わせ、
 * 完了を検知したらプッシュ通知を送る。S3イベント連携（Lambda→APNs）に
 * 移行するまでの実装だが、Webの状態自動更新にも効く。
 */

import pool from '../db';
import { GlacierPhotoService } from '../services/GlacierPhotoService';
import { sendPushToUser } from '../services/PushService';

const glacierService = new GlacierPhotoService();

// 1回のジョブでチェックする上限（S3 HeadObjectの呼びすぎ防止）
const BATCH_LIMIT = 500;

export async function runRestoreCheckJob(): Promise<{ checked: number; completed: number }> {
  const res = await pool.query(
    `SELECT id, user_id, original_name FROM photos
     WHERE status IN ('restore_requested', 'restoring')
     ORDER BY uploaded_at ASC
     LIMIT $1`,
    [BATCH_LIMIT]
  );

  let completed = 0;
  for (const row of res.rows) {
    try {
      // checkRestoreStatus はDBのstatus/restored_untilも更新する
      const newStatus = await glacierService.checkRestoreStatus(row.id);
      if (newStatus === 'restored') {
        completed++;
        await sendPushToUser(
          row.user_id,
          '復元が完了しました',
          `「${row.original_name}」のダウンロード準備ができました（7日間有効）`,
          { photoId: row.id, type: 'restore_completed' }
        );
      }
    } catch (error: any) {
      console.warn(`Restore check failed for photo ${row.id}: ${error.message}`);
    }
  }

  if (res.rows.length > 0) {
    console.log(`🔄 Restore check: ${res.rows.length} checked, ${completed} newly completed`);
  }
  return { checked: res.rows.length, completed };
}

export function scheduleRestoreCheckJob(intervalMinutes: number = 15): NodeJS.Timeout {
  console.log(`📅 Scheduling restore check job every ${intervalMinutes} minutes`);
  runRestoreCheckJob().catch(console.error);
  return setInterval(() => {
    runRestoreCheckJob().catch(console.error);
  }, intervalMinutes * 60 * 1000);
}
