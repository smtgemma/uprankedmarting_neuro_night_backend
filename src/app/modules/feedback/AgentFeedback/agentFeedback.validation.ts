import { z } from "zod";

const createAgentFeedbackValidation = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    feedbackText: z.string().optional(),
  }),
});

const updateAgentFeedbackValidation = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    feedbackText: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid agent feedback id"), // Keep UUID for feedback ID if intended
  }),
});

export const AgentFeedbackValidation = {
  createAgentFeedbackValidation,
  updateAgentFeedbackValidation,
};
