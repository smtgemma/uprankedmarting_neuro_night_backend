import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { TwilioPhoneNumberController } from "./availableNumbers.controller";
const router = express.Router();

// Super Admin: Get all numbers with filters (purchased/unpurchased)
router.get(
  "/admin/all",
  auth(UserRole.super_admin),
  TwilioPhoneNumberController.getAllNumbersForAdmin
);

// Super Admin: Get all phone number requests
router.get(
  "/admin/requests",
  auth(UserRole.super_admin),
  TwilioPhoneNumberController.getAllPhoneNumberRequests
);

// Super Admin: Approve/Reject phone number request
router.patch(
  "/admin/requests/:id/status",
  auth(UserRole.super_admin),
  TwilioPhoneNumberController.updateRequestStatus
);

// Super Admin: Pin/Unpin number for organization
router.patch(
  "/admin/:id/pin",
  auth(UserRole.super_admin),
  TwilioPhoneNumberController.togglePinNumber
);

// Organization Admin: Get available numbers (all + org's requested numbers)
router.get(
  "/organization/available",
  auth(UserRole.organization_admin),
  TwilioPhoneNumberController.getAvailableNumbersForOrg
);

// Organization Admin: Request a phone number
router.post(
  "/organization/request",
  auth(UserRole.organization_admin),
  TwilioPhoneNumberController.requestPhoneNumber
);

//  -------------
router.get(
  "/",
  auth(UserRole.super_admin, UserRole.organization_admin),
  TwilioPhoneNumberController.getAllTwilioPhoneNumbers
);
router.get(
    "/get-available-numbers",
    auth(UserRole.super_admin),
    TwilioPhoneNumberController.fetchAndStoreAvailableNumbers
)

router.get(
  "/:id",
  auth(UserRole.super_admin, UserRole.organization_admin),
  TwilioPhoneNumberController.getSingleTwilioPhoneNumber
);


router.post(
  "/",
  auth(UserRole.super_admin),
//   validateRequest(TwilioPhoneNumberValidation.createTwilioPhoneNumberZodSchema),
  TwilioPhoneNumberController.createTwilioPhoneNumber
);
export const TwilioPhoneNumberRoutes = router;