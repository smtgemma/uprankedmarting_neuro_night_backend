import { Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  cancelSubscriptionValidation,
  createSubscriptionValidation,
  switchPlanValidation,
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
  "/my-subscription",
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

router.get(
  "/billing-history",
  auth("organization_admin"),
  SubscriptionController.getBillingHistory
);

router.post(
  "/switch",
  auth("organization_admin"),
  validateRequest(switchPlanValidation),
  SubscriptionController.switchPlan
);

export const SubscriptionRoutes = router;