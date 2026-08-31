import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';

vi.mock('../services/StripeService', () => ({
  stripeService: { constructWebhookEvent: vi.fn() },
}));
vi.mock('../services/BillingService', () => ({
  billingService: {
    handlePaymentSuccess: vi.fn(),
    handlePaymentFailure: vi.fn(),
    handleSubscriptionCanceled: vi.fn(),
  },
}));

import { mountStripeWebhook } from './mountStripeWebhook';

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  mountStripeWebhook(app);
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('mountStripeWebhook', () => {
  it('POST /api/webhooks/stripe is mounted (400 missing signature, not 404)', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/webhooks/stripe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: 'Missing stripe-signature header',
      });
    });
  });

  it('keeps POST /api/webhook/stripe for the old path', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/webhook/stripe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });
});
