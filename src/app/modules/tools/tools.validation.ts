import { z } from "zod";

const CreateLeadSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Invalid organization ID"),
  }),
});

export const ToolsValidation = {
  CreateLeadSchema,
};