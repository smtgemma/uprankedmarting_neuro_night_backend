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

// User schema
const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10, "Phone number is required"),
});

// Organization schema (optional)
const organizationSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  websiteLink: z.string().url("Invalid URL").optional(),
  address: z.string().min(2, "Address is required"),
  industry: z.string().min(2, "Industry is required"),
  logoUrl: z.string().url("Invalid URL").optional(),
}).partial(); // makes all fields optional if needed

// Agent schema (optional)
const agentSchema = z.object({
  dateOfBirth: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  gender: z.enum(["male", "female", "other"]),
  address: z.string().min(2),
  emergencyPhone: z.string().min(10),
  ssn: z.string().min(1),
  skills: z.array(z.string()).optional(),
  employeeId: z.string().min(1),
  officeHours: z.number().min(0),
  isAvailable: z.boolean(),
}).partial();
  
// Full payload schema
const createUserPayloadSchema = z.object({
  userData: userSchema,
  organizationData: organizationSchema.optional(),
  agentData: agentSchema.optional(),
});


export const UserValidation = {
  createUserPayloadSchema,
  updateUserValidationSchema,
  updateAgentValidationSchema,
};
