/**
 * Sign in with Apple のidentityToken検証
 *
 * AppleのJWKS（https://appleid.apple.com/auth/keys）で署名を検証し、
 * audience（バンドルID）とissuerを確認する。外部依存なし（Node標準cryptoのJWKインポートを使用）。
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

interface AppleJwk {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

export interface AppleIdentity {
  sub: string; // Appleのユーザー識別子（安定）
  email?: string;
  emailVerified?: boolean;
}

let jwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

async function getAppleJwks(): Promise<AppleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Apple JWKS: ${res.status}`);
  }
  const body = (await res.json()) as { keys: AppleJwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/**
 * identityTokenを検証してApple識別子を返す。検証失敗時はthrow。
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  const audience = process.env.APPLE_BUNDLE_ID;
  if (!audience) {
    throw new Error('APPLE_BUNDLE_ID is not configured');
  }

  const decodedHeader = jwt.decode(identityToken, { complete: true })?.header;
  if (!decodedHeader?.kid) {
    throw new Error('Invalid Apple identity token (no kid)');
  }

  const keys = await getAppleJwks();
  const jwk = keys.find((k) => k.kid === decodedHeader.kid);
  if (!jwk) {
    // キーローテーション直後の可能性があるためキャッシュを破棄して1回だけ再取得
    jwksCache = null;
    const refreshed = await getAppleJwks();
    const retryJwk = refreshed.find((k) => k.kid === decodedHeader.kid);
    if (!retryJwk) {
      throw new Error('Apple signing key not found');
    }
    return verifyWithJwk(identityToken, retryJwk, audience);
  }

  return verifyWithJwk(identityToken, jwk, audience);
}

function verifyWithJwk(token: string, jwk: AppleJwk, audience: string): AppleIdentity {
  const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience,
  }) as jwt.JwtPayload;

  if (!payload.sub) {
    throw new Error('Apple identity token has no subject');
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
  };
}
