// user.validation.ts
import { z } from "zod";

const updateUserValidationSchema = z.object({
  name: z.string().min(1).optional(),
  // email: z.string().email().optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  image: z.string().optional(),
  // role: z.enum(['organization_admin', 'agent', 'super_admin']).optional(),
});

const updateAgentValidationSchema = z.object({
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  emergencyPhone: z.string().optional(),
  ssn: z.string().optional(),
  skills: z.array(z.string()).optional(),
  employeeId: z.string().optional(),
  officeHours: z.number().optional(),
  isAvailable: z.boolean().optional(),
});

export const UserValidation = {
  updateUserValidationSchema,
  updateAgentValidationSchema,
};
