import { PlanLevel } from "@prisma/client";
import { z } from "zod";

const SubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    organizationId: z.string().min(1, "Organization ID is required"),
    // planLevel: z.enum(["only_real_agent", "only_ai", "ai_then_real_agent"]).optional(),
    planLevel: z.enum(Object.values(PlanLevel) as [string, ...string[]]),
    purchasedNumber: z.string().min(1, "Purchased number is required"), // E.164 format validation
    sid: z.string().min(1, "Stripe subscription ID is required"),
  }),
});

const UpdateSubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required").optional(),
    paymentStatus: z
      .enum(["PENDING", "COMPLETED", "CANCELED", "REFUNDED"])
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    amount: z.number().min(0, "Amount must be positive").optional(),
    planLevel: z
      .enum(Object.values(PlanLevel) as [string, ...string[]])
      .optional(),
    purchasedNumber: z
      .string()
      .min(1, "Purchased number is required")
      .optional(),
    sid: z.string().min(1, "Stripe subscription ID is required").optional(),
  }),
});

export const SubscriptionValidation = {
  SubscriptionValidationSchema,
  UpdateSubscriptionValidationSchema,
};
