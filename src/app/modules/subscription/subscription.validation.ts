import { PlanLevel } from "@prisma/client";
import { z } from "zod";

const SubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    organizationId: z.string().min(1, "Organization ID is required"),
    planLevel: z.enum(Object.values(PlanLevel) as [string, ...string[]]),
    purchasedNumber: z.string().min(1, "Purchased number is required"),
    sid: z.string().min(1, "SID is required"),
    numberOfAgents: z.number().int().min(0).optional(),
  }),
});

const UpdateSubscriptionValidationSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required").optional(),
    paymentStatus: z
      .enum(["PENDING", "COMPLETED", "CANCELED", "REFUNDED"])
      .optional(),
    status: z
      .enum([
        "ACTIVE",
        "TRIALING",
        "PAST_DUE",
        "CANCELED",
        "INCOMPLETE",
        "INCOMPLETE_EXPIRED",
        "UNPAID",
      ])
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    trialEndDate: z.string().datetime().optional(),
    amount: z.number().min(0, "Amount must be positive").optional(),
    planLevel: z
      .enum(Object.values(PlanLevel) as [string, ...string[]])
      .optional(),
    purchasedNumber: z
      .string()
      .min(1, "Purchased number is required")
      .optional(),
    sid: z.string().min(1, "SID is required").optional(),
    numberOfAgents: z.number().int().min(0).optional(),
  }),
});

const ChangePlanValidationSchema = z.object({
  body: z.object({
    newPlanId: z.string().min(1, "New plan ID is required"),
    numberOfAgents: z.number().int().min(1).optional(),
  }),
});

const UpdateAgentCountValidationSchema = z.object({
  body: z.object({
    numberOfAgents: z
      .number()
      .int()
      .min(1, "Number of agents must be at least 1"),
  }),
});

export const SubscriptionValidation = {
  SubscriptionValidationSchema,
  UpdateSubscriptionValidationSchema,
  ChangePlanValidationSchema,
  UpdateAgentCountValidationSchema,
};
