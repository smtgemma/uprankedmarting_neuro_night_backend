import { Request, Response, NextFunction } from 'express';
import { buffer } from 'micro';
import Stripe from 'stripe';
import config from '../config';
import { stripe } from './stripe';
// import config from '../config';
// import { stripe } from '../utils/stripe';

export const verifyStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  if (!config.stripe.webhook_secret) {
    return res.status(500).json({ error: 'Stripe webhook secret not configured' });
  }

  let event: Stripe.Event;
  
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody.toString(),
      signature,
      config.stripe.webhook_secret
    );
    req.body = event;
    next();
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
};