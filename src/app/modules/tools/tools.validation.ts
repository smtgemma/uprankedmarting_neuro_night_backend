import { z } from "zod";

const CreateLeadSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Invalid organization ID"),
  }),
});

const questionValidationSchema = z.object({
  params: z.object({
    orgId: z.string().min(1, "Organization ID is required"),
  }),
});

export const ToolsValidation = {
  CreateLeadSchema,
  questionValidationSchema
};