import { z } from "zod";

const CreateLeadSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid("Invalid organization ID"),
  }),
});

const questionValidationSchema = z.object({
  params: z.object({
    orgId: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
      message: "Invalid MongoDB ObjectId for orgId",
    }),
  }),
});

const configureGoogleSheetsSchema = z.object({
  body: z.object({
    spreadsheetId: z.string({
      required_error: "Spreadsheet ID is required",
    }), 
    credentials: z.object(
      {
        client_email: z
          .string({
            required_error: "Client email is required",
          })
          .email("Invalid client email format"),
        private_key: z.string({
          required_error: "Private key is required",
        }),
      },
      {
        required_error: "Credentials object is required",
      }
    ),
  }),
});

export const ToolsValidation = {
  CreateLeadSchema,
  questionValidationSchema,
  configureGoogleSheetsSchema,
};
