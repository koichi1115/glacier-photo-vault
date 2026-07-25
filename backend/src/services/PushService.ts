/**
 * APNs プッシュ通知サービス（トークンベース認証・依存パッケージなし）
 *
 * 必要な環境変数（未設定時は送信をスキップし、ログのみ）:
 *   APNS_KEY_ID      — Apple Developer の APNs Auth Key ID
 *   APNS_TEAM_ID     — Team ID
 *   APNS_PRIVATE_KEY — .p8 の中身（改行は \n エスケープ可）
 *   APPLE_BUNDLE_ID  — apns-topic に使用
 *   APNS_ENV         — 'production' | 'sandbox'（デフォルト sandbox）
 */

import http2 from 'http2';
import jwt from 'jsonwebtoken';
import pool from '../db';

let cachedProviderToken: { token: string; issuedAt: number } | null = null;

function getProviderToken(): string | null {
  const key = process.env.APNS_PRIVATE_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) return null;

  // APNsのプロバイダトークンは20分〜60分有効。40分でローテーション
  const now = Math.floor(Date.now() / 1000);
  if (cachedProviderToken && now - cachedProviderToken.issuedAt < 40 * 60) {
    return cachedProviderToken.token;
  }

  const token = jwt.sign({}, key.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    issuer: teamId,
    keyid: keyId,
  });
  cachedProviderToken = { token, issuedAt: now };
  return token;
}

function apnsHost(): string {
  return process.env.APNS_ENV === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

/**
 * 1台のデバイスへ送信。トークン失効時は 'unregistered' を返す。
 */
function sendToDevice(
  deviceToken: string,
  payload: object,
  providerToken: string
): Promise<'ok' | 'unregistered' | 'error'> {
  return new Promise((resolve) => {
    const client = http2.connect(apnsHost());
    client.on('error', () => resolve('error'));

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': process.env.APPLE_BUNDLE_ID || '',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';
    req.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      client.close();
      if (status === 200) return resolve('ok');
      if (status === 410 || body.includes('BadDeviceToken') || body.includes('Unregistered')) {
        return resolve('unregistered');
      }
      console.warn(`APNs send failed (${status}): ${body}`);
      resolve('error');
    });
    req.on('error', () => {
      client.close();
      resolve('error');
    });

    req.end(JSON.stringify(payload));
  });
}

/**
 * ユーザーの全デバイスへ通知を送る。失効トークンは自動削除。
 * APNs未設定の環境では何もしない（開発環境向け）。
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const providerToken = getProviderToken();
  if (!providerToken) {
    console.log(`📵 APNs not configured — skipping push to ${userId}: ${title}`);
    return;
  }

  const res = await pool.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) return;

  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
    },
    ...extra,
  };

  for (const row of res.rows) {
    const result = await sendToDevice(row.token, payload, providerToken);
    if (result === 'unregistered') {
      await pool.query('DELETE FROM device_tokens WHERE token = $1', [row.token]);
    }
  }
}
