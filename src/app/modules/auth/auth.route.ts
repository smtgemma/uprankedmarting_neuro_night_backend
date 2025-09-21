import { UserRole } from "@prisma/client";
import { Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();


router.get(
  "/me",
  auth(UserRole.agent, UserRole.organization_admin, UserRole.super_admin),
  AuthController.getMe
);

router.get(
  "/get-user/:id",
  auth(UserRole.agent, UserRole.organization_admin, UserRole.super_admin),
  AuthController.getSingleUser
);

router.get(
  "/get-agent-info/:id",
  auth(UserRole.agent, UserRole.organization_admin, UserRole.super_admin),
  AuthController.getSingleAgentInfo
);

router.post(
  "/login",
  validateRequest(AuthValidation.loginValidationSchema),
  AuthController.login
);

router.post(
  "/verify-otp",
  validateRequest(AuthValidation.verifyOTPSchema),
  AuthController.verifyOTP
);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPasswordValidationSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(AuthValidation.resetPasswordWithOTPSchema),
  AuthController.resetPasswordWithOTP
);

router.post(
  "/resend-otp",
  validateRequest(AuthValidation.resendOTPSchema),
  AuthController.resendOTP
);

router.post(
  "/refresh-token",
  validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthController.refreshToken
);

router.post(
  "/change-password",
  auth(UserRole.agent, UserRole.organization_admin, UserRole.super_admin),
  validateRequest(AuthValidation.changePasswordValidationSchema),
  AuthController.changePassword
);


export const AuthRoutes = router;