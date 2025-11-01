// modules/plan/plan.validation.ts
import { z } from "zod";

const planLevelSchema = z.enum([
  "only_real_agent",
  "only_ai",
  "ai_then_real_agent",
]);
const intervalSchema = z.enum(["MONTH", "YEAR"]);

export const createPlanValidation = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    description: z.string().optional(),
    price: z.number().positive("Price must be positive"),
    interval: intervalSchema,
    trialDays: z.number().int().min(0).max(365).optional(),
    features: z.array(z.string()).optional(), // ← string[]
    planLevel: planLevelSchema,
    defaultAgents: z.number().int().min(0).optional(),
    extraAgentPricing: z
      .array(
        z.object({
          agents: z.number().int().positive("Agents must be positive"),
          price: z.number().nonnegative("Price must be non-negative"),
        })
      )
      .optional(),
    totalMinuteLimit: z.number().int().min(0).optional(),
  }),
});

export const updatePlanValidation = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    description: z.string().optional(),
    price: z.number().positive().optional(),
    interval: intervalSchema.optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    isActive: z.boolean().optional(),
    features: z.array(z.string()).optional(), // ← string[]
    planLevel: planLevelSchema.optional(),
    defaultAgents: z.number().int().min(0).optional(),
    extraAgentPricing: z
      .array(
        z.object({
          agents: z.number().int().positive(),
          price: z.number().nonnegative(),
        })
      )
      .optional(),
    totalMinuteLimit: z.number().int().min(0).optional(),
  }),
});