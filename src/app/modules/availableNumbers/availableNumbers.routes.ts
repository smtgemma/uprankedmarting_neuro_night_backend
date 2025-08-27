import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import { TwilioPhoneNumberController } from "./availableNumbers.controller";
const router = express.Router();

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

router.patch(
  "/:sid",
  auth(UserRole.super_admin, UserRole.organization_admin),
//   validateRequest(TwilioPhoneNumberValidation.updateTwilioPhoneNumberZodSchema),
  TwilioPhoneNumberController.updateTwilioPhoneNumber
);

router.delete(
  "/:sid",
  auth(UserRole.super_admin),
  TwilioPhoneNumberController.deleteTwilioPhoneNumber
);

export const TwilioPhoneNumberRoutes = router;