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

import { Twilio } from "twilio";

// router.post('/agent/token', async (req, res) => {
//   const { agentId } = req.body;
//   const accountSid = process.env.TWILIO_ACCOUNT_SID;
//   const authToken = process.env.TWILIO_AUTH_TOKEN;
//   const twilioApiKey = process.env.TWILIO_API_KEY;
//   const twilioApiSecret = process.env.TWILIO_API_SECRET;
//   const workspaceSid = process.env.TWILIO_WORKSPACE_SID;

//   try {
//     const identity = `agent_${agentId}`;
//     const capability = new Twilio.jwt.AccessToken(accountSid, twilioApiKey, twilioApiSecret, {
//       identity,
//       ttl: 3600, // Token valid for 1 hour
//     });

//     // Grant access to Voice
//     const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
//       outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
//       incomingAllow: true,
//     });
//     capability.addGrant(voiceGrant);

//     // Grant access to TaskRouter
//     const taskRouterGrant = new twilio.jwt.AccessToken.TaskRouterGrant({
//       workspaceSid,
//       workerSid: `WK${agentId}`,
//       role: 'worker',
//     });
//     capability.addGrant(taskRouterGrant);

//     const token = capability.toJwt();
//     res.json({ token, identity });
//   } catch (error) {
//     console.error('Token generation error:', error);
//     res.status(500).json({ error: 'Failed to generate token' });
//   }
// });

export const AuthRoutes = router;