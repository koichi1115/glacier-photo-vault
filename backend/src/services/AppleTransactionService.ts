/**
 * StoreKit 2 署名付きトランザクション（JWS）の検証とサブスクリプション同期
 *
 * iOSアプリから送られる transaction.jwsRepresentation を検証する:
 *   1. JWSヘッダの x5c 証明書チェーンを Apple Root CA G3 まで検証
 *   2. リーフ証明書の公開鍵でES256署名を検証
 *   3. bundleId / productId / 有効期限を確認
 *
 * Apple Root CA G3 は公開証明書を起動時に取得してキャッシュする
 * （https://www.apple.com/certificateauthority/）。
 */

import crypto from 'crypto';
import { findTierByAppleProductId, StorageTier } from '../config/tiers';
import pool from '../db';
import { Subscription } from './StripeService';
import { billingService } from './BillingService';

const APPLE_ROOT_CA_G3_URL = 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer';

export interface AppleTransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  type: string; // 'Auto-Renewable Subscription' etc.
  offerType?: number; // 1 = introductory (トライアル)
  revocationDate?: number;
  environment?: string; // 'Sandbox' | 'Production'
}

let cachedRootCert: crypto.X509Certificate | null = null;

async function getAppleRootCert(): Promise<crypto.X509Certificate> {
  if (cachedRootCert) return cachedRootCert;
  const res = await fetch(APPLE_ROOT_CA_G3_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Apple Root CA G3: ${res.status}`);
  }
  const der = Buffer.from(await res.arrayBuffer());
  cachedRootCert = new crypto.X509Certificate(der);
  return cachedRootCert;
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * JWSを検証してペイロードを返す。失敗時はthrow。
 */
export async function verifySignedTransaction(jws: string): Promise<AppleTransactionPayload> {
  const parts = jws.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWS format');
  }

  const header = JSON.parse(b64urlToBuffer(parts[0]).toString('utf8'));
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error('Unexpected JWS header');
  }

  // 証明書チェーンの検証（leaf → intermediate → Apple Root CA G3）
  const certs = header.x5c.map(
    (c: string) => new crypto.X509Certificate(Buffer.from(c, 'base64'))
  );
  const root = await getAppleRootCert();

  for (let i = 0; i < certs.length - 1; i++) {
    if (!certs[i].verify(certs[i + 1].publicKey)) {
      throw new Error(`Certificate chain verification failed at index ${i}`);
    }
  }
  const last = certs[certs.length - 1];
  const chainedToRoot = last.fingerprint256 === root.fingerprint256 || last.verify(root.publicKey);
  if (!chainedToRoot) {
    throw new Error('Certificate chain does not terminate at Apple Root CA G3');
  }

  // 署名検証
  const verified = crypto.verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' },
    b64urlToBuffer(parts[2])
  );
  if (!verified) {
    throw new Error('JWS signature verification failed');
  }

  const payload = JSON.parse(b64urlToBuffer(parts[1]).toString('utf8')) as AppleTransactionPayload;

  const expectedBundleId = process.env.APPLE_BUNDLE_ID;
  if (expectedBundleId && payload.bundleId !== expectedBundleId) {
    throw new Error(`Unexpected bundleId: ${payload.bundleId}`);
  }
  if (payload.revocationDate) {
    throw new Error('Transaction has been revoked');
  }

  return payload;
}

/**
 * 検証済みトランザクションをsubscriptionsテーブルへ同期する
 */
export async function syncAppleSubscription(
  userId: string,
  payload: AppleTransactionPayload
): Promise<Subscription> {
  const tier: StorageTier | null = findTierByAppleProductId(payload.productId);
  if (!tier) {
    throw new Error(`Unknown product: ${payload.productId}`);
  }

  const now = Date.now();
  const expiresAt = payload.expiresDate ?? null;
  const isActive = expiresAt !== null && expiresAt > now;
  const isTrial = payload.offerType === 1;
  const status = isActive ? (isTrial ? 'trialing' : 'active') : 'canceled';

  await pool.query(
    `INSERT INTO subscriptions (
       user_id, platform, tier, storage_limit_bytes, status,
       apple_original_transaction_id, current_period_start, current_period_end,
       trial_start, trial_end, created_at, updated_at
     ) VALUES ($1, 'apple', $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     ON CONFLICT (user_id) DO UPDATE SET
       platform = 'apple',
       tier = $2,
       storage_limit_bytes = $3,
       status = $4,
       apple_original_transaction_id = $5,
       current_period_start = $6,
       current_period_end = $7,
       trial_start = COALESCE(subscriptions.trial_start, $8),
       trial_end = $9,
       updated_at = $10`,
    [
      userId,
      tier.id,
      tier.storageLimitBytes,
      status,
      payload.originalTransactionId,
      payload.purchaseDate ?? now,
      expiresAt,
      isTrial ? payload.purchaseDate ?? now : null,
      isTrial ? expiresAt : null,
      now,
    ]
  );

  return (await billingService.getSubscription(userId))!;
}
