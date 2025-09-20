import { z } from "zod";

const orgIdSchema = z.object({
  params: z.object({
    orgId: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
      message: "Invalid organization",
    }),
  }),
});

export const HubSpotValidation = {
  orgIdSchema,
};