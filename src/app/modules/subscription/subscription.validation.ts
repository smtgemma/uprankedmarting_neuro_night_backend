import { z } from "zod";

const SubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    organizationId: z.string().min(1, "Organization ID is required"),
  }),
});

const UpdateSubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required").optional(),
    paymentStatus: z.enum(["PENDING", "COMPLETED", "CANCELED", "REFUNDED"]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    amount: z.number().min(0, "Amount must be positive").optional(),
  }),
});

export const SubscriptionValidation = {
  SubscriptionValidationSchema,
  UpdateSubscriptionValidationSchema,
};