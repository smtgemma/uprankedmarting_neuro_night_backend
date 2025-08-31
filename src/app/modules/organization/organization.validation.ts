// import { z } from "zod";

// const OrganizationQueryValidationSchema = z.object({
//   query: z.object({
//     page: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
//     limit: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
//     search: z.string().optional(),
//     name: z.string().optional(),
//     organizationNumber: z.string().optional(),
//   }).optional(),
// });

// const CreateOrganizationValidationSchema = z.object({
//   body: z.object({
//     name: z.string().min(1, "Name is required"),
//     address: z.string().min(1, "Address is required"),
//     websiteLink: z.string().url("Invalid URL").optional(),
//     organizationNumber: z.string().min(1, "Organization number is required").optional(),
//     ownerId: z.string().min(1, "Owner ID is required"),
//     sipDomain: z.string().optional(),
//     agentVoiceUrl: z.string().optional(),
//     leadQuestions: z.array(z.string()).optional(),
//   }),
// });

// const UpdateOrganizationValidationSchema = z.object({
//   body: z.object({
//     name: z.string().min(1, "Name is required").optional(),
//     address: z.string().min(1, "Address is required").optional(),
//     websiteLink: z.string().url("Invalid URL").optional(),
//     organizationNumber: z.string().min(1, "Organization number is required").optional(),
//     ownerId: z.string().min(1, "Owner ID is required").optional(),
//     sipDomain: z.string().optional(),
//     agentVoiceUrl: z.string().optional(),
//     leadQuestions: z.array(z.string()).optional(),
//   }),
// });

// export const OrganizationValidation = {
//   OrganizationQueryValidationSchema,
//   CreateOrganizationValidationSchema,
//   UpdateOrganizationValidationSchema,
// };