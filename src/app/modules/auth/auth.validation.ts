import { z } from "zod";

const loginValidationSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters long" }),
  }),
});

const verifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.number().int().min(1000, "OTP must be a 4-digit number").max(9999, "OTP must be a 4-digit number"),
    isVerification: z.boolean().optional().default(true),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    currentPassword: z
      .string({ required_error: "Current password is required" })
      .min(6, {
        message: "Current password must be at least 6 characters long",
      }),
    newPassword: z
      .string({ required_error: "New password is required" })
      .min(6, { message: "New password must be at least 6 characters long" }),
    confirmPassword: z
      .string({ required_error: "Confirm password is required" })
      .min(6, { message: "Confirm password must be at least 6 characters long" }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password do not match!",
    path: ["confirmPassword"],
  }),
});

const resetPasswordWithOTPSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.number().int().min(1000, "OTP must be a 4-digit number").max(9999, "OTP must be a 4-digit number"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match!",
    path: ["confirmPassword"],
  }),
});

const forgotPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
  }),
});

const resendOTPSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
  }),
});

const refreshTokenValidationSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: "Refresh token is required" }),
  }),
});

export const AuthValidation = {
  loginValidationSchema,
  verifyOTPSchema,
  changePasswordValidationSchema,
  resetPasswordWithOTPSchema,
  forgotPasswordValidationSchema,
  resendOTPSchema,
  refreshTokenValidationSchema,
};