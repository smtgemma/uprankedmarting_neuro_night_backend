import { Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  cancelSubscriptionValidation,
  createSubscriptionValidation,
} from "./subscription.validation";
import { SubscriptionController } from "./subscription.controller";

const router = Router();

router.post(
  "/",
  auth("organization_admin"),
  validateRequest(createSubscriptionValidation),
  SubscriptionController.createSubscription
);
router.get(
  "/my",
  auth("organization_admin"),
  SubscriptionController.getOrgSubscriptions
);
router.post(
  "/cancel",
  auth("organization_admin"),
  validateRequest(cancelSubscriptionValidation),
  SubscriptionController.cancelSubscription
);
router.post(
  "/:id/resume",
  auth("organization_admin"),
  SubscriptionController.resumeSubscription
);

export const SubscriptionRoutes = router;
