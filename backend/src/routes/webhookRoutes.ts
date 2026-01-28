import express, { Request, Response } from 'express';
import { stripeService } from '../services/StripeService';
import { billingService } from '../services/BillingService';
import Stripe from 'stripe';

const router = express.Router();

/**
 * POST /api/webhook/stripe
 * Handle Stripe webhook events
 * Note: This endpoint must use raw body parser (express.raw)
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      event = stripeService.constructWebhookEvent(
        req.body,
        signature as string
      );
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error.message);
      return res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }

    console.log(`📩 Received Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            await billingService.handlePaymentSuccess(customerId, subscriptionId);
            console.log(`✅ Payment succeeded for customer: ${customerId}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;

          await billingService.handlePaymentFailure(customerId);
          console.log(`❌ Payment failed for customer: ${customerId}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await billingService.handleSubscriptionCanceled(subscription.id);
          console.log(`🗑️ Subscription canceled: ${subscription.id}`);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);
          // Handle status changes if needed
          break;
        }

        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`⏰ Trial ending soon for subscription: ${subscription.id}`);
          // Could send notification email here
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

export default router;
