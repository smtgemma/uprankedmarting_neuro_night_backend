import { z } from 'zod';

const capabilitiesSchema = z.object({
  voice: z.boolean().optional(),
  sms: z.boolean().optional(),
  mms: z.boolean().optional(),
  fax: z.boolean().optional(),
});

const createTwilioPhoneNumberZodSchema = z.object({
  body: z.object({
    phoneNumber: z.string().optional(),
    areaCode: z.string().optional(),
    capabilities: capabilitiesSchema.optional(),
    friendlyName: z.string().optional(),
    voiceUrl: z.string().url().optional().nullable(),
    smsUrl: z.string().url().optional().nullable(),
  }),
});

const updateTwilioPhoneNumberZodSchema = z.object({
  body: z.object({
    friendlyName: z.string().optional(),
    voiceUrl: z.string().url().optional().nullable(),
    smsUrl: z.string().url().optional().nullable(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

export const TwilioPhoneNumberValidation = {
  createTwilioPhoneNumberZodSchema,
  updateTwilioPhoneNumberZodSchema,
};