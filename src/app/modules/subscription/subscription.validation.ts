// modules/subscription/subscription.validation.ts
import { z } from "zod";

export const createSubscriptionValidation = z.object({
  body: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid plan ID"),
    paymentMethodId: z.string().startsWith("pm_", "Invalid payment method"),
    purchasedNumber: z.string().optional(),
    sid: z.string().optional(),
    extraAgents: z.number().int().min(0).max(3).optional(),
  }),
});

export const cancelSubscriptionValidation = z.object({
  body: z.object({
    subscriptionId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid subscription ID"),
    cancelAtPeriodEnd: z.boolean().optional(),
  }),
});
