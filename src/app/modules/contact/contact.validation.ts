import { z } from "zod";

const ContactFormSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    message: z.string().min(1, "Message is required"),
  }),
});

export const ContactValidation = {
  ContactFormSchema,
};
