import { Interval, PlanLevel } from "@prisma/client";
import { z } from "zod";

export const planValidationSchema = z.object({
  body: z.object({
    planName: z.string().min(1, "Plan name is required"),
    description: z.string().max(500).optional(),
    amount: z.number().min(0, "Amount must be positive"),
    currency: z.string().length(3).default("usd"),
    interval: z
      .enum(Object.values(Interval) as [string, ...string[]])
      .default("month"),
    intervalCount: z.number().int().positive().default(1),
    freeTrialDays: z.number().int().nonnegative().optional().default(0),
    active: z.boolean().default(true).optional(),
    planLevel: z.enum(Object.values(PlanLevel) as [string, ...string[]]),
    extraAgentPricing: z
      .array(
        z.object({
          agents: z.number().int().positive("Agents must be positive"),
          price: z.number().positive("Price must be positive"),
        })
      )
      .optional()
      .default([]),
    features: z.any().optional(),
  }),
});

export const updatePlanValidationSchema = z.object({
  body: z.object({
    planName: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    amount: z.number().min(0).optional(),
    active: z.boolean().optional(),
    freeTrialDays: z.number().int().nonnegative().optional(),
    planLevel: z
      .enum(Object.values(PlanLevel) as [string, ...string[]])
      .optional(),
    extraAgentPricing: z
      .array(
        z.object({
          agents: z.number().int().positive(),
          price: z.number().positive(),
        })
      )
      .optional(),
  }),
});
