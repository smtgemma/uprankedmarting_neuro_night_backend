import { z } from "zod";

const CreateLeadSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Invalid organization ID"),
  }),
});

const questionValidationSchema = z.object({
  params: z.object({
    orgId: z.string().refine(
      (val) => /^[0-9a-fA-F]{24}$/.test(val),
      { message: "Invalid MongoDB ObjectId for orgId" }
    ),
  }),
});

export const ToolsValidation = {
  CreateLeadSchema,
  questionValidationSchema,
};