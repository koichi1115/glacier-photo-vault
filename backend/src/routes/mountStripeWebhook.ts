import type { Express } from 'express';
import webhookRoutes from './webhookRoutes';

/** Stripe Dashboard は /api/webhooks/stripe。旧パス /api/webhook/stripe も残す。 */
export const STRIPE_WEBHOOK_MOUNTS = ['/api/webhooks', '/api/webhook'] as const;

export function mountStripeWebhook(app: Express): void {
  for (const prefix of STRIPE_WEBHOOK_MOUNTS) {
    app.use(prefix, webhookRoutes);
  }
}
