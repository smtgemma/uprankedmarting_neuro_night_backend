import { z } from "zod";

const createServiceFeedbackValidation = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    feedbackText: z.string().optional(), // Changed from 'comment' to match schema
  }),
});

const updateServiceFeedbackValidation = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    feedbackText: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid service feedback id"),
  }),
});

export const ServiceFeedbackValidation = {
  createServiceFeedbackValidation,
  updateServiceFeedbackValidation,
};