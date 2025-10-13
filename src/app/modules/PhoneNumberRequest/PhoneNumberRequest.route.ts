// ============ 1. ROUTES ============
// phone-number-request.routes.ts

import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
// import { PhoneNumberRequestValidation } from "./phoneNumberRequest.validation";
import validateRequest from "../../middlewares/validateRequest";
import { PhoneNumberRequestController } from "./PhoneNumberRequest.controller";

const router = express.Router();

// Organization Admin - Submit request
router.post(
  "/submit-request",
  auth(UserRole.organization_admin),
//   validateRequest(PhoneNumberRequestValidation.submitRequestZodSchema),
  PhoneNumberRequestController.submitPhoneNumberRequest
);

// Super Admin - Get all requests
router.get(
  "/",
  auth(UserRole.super_admin),
  PhoneNumberRequestController.getAllPhoneNumberRequests
);

// Super Admin - Get single request
router.get(
  "/:id",
  auth(UserRole.super_admin),
  PhoneNumberRequestController.getSinglePhoneNumberRequest
);

// Super Admin - Approve request
router.patch(
  "/:id/approve",
  auth(UserRole.super_admin),
  PhoneNumberRequestController.approvePhoneNumberRequest
);

// Super Admin - Reject request
router.patch(
  "/:id/reject",
  auth(UserRole.super_admin),
//   validateRequest(PhoneNumberRequestValidation.rejectRequestZodSchema),
  PhoneNumberRequestController.rejectPhoneNumberRequest
);

export const PhoneNumberRequestRoutes = router;