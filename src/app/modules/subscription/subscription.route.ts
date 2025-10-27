import { Router } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import { SubscriptionValidation } from "./subscription.validation";
import { SubscriptionController } from "./subscription.controller";

const router = Router();

// Create new subscription (with trial)
router.post(
  "/create-subscription",
  auth(UserRole.organization_admin, UserRole.super_admin),
  validateRequest(SubscriptionValidation.SubscriptionValidationSchema),
  SubscriptionController.createSubscription
);

router.post(
  "/create-setup-intent",
  auth(UserRole.organization_admin),
  SubscriptionController.createSetupIntent
);

// Get my subscription
router.get(
  "/my-subscription",
  auth(UserRole.organization_admin, UserRole.super_admin),
  SubscriptionController.getMySubscription
);

// Get all subscriptions (admin only)
router.get(
  "/",
  auth(UserRole.super_admin),
  SubscriptionController.getAllSubscription
);

// Get single subscription
router.get(
  "/:subscriptionId",
  auth(UserRole.organization_admin, UserRole.super_admin),
  SubscriptionController.getSingleSubscription
);

// Update subscription
router.put(
  "/:subscriptionId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  validateRequest(SubscriptionValidation.UpdateSubscriptionValidationSchema),
  SubscriptionController.updateSubscription
);

// Change plan (upgrade/downgrade)
router.put(
  "/:subscriptionId/change-plan",
  auth(UserRole.organization_admin, UserRole.super_admin),
  validateRequest(SubscriptionValidation.ChangePlanValidationSchema),
  SubscriptionController.changePlan
);

// Update agent count
router.put(
  "/:subscriptionId/update-agents",
  auth(UserRole.organization_admin, UserRole.super_admin),
  validateRequest(SubscriptionValidation.UpdateAgentCountValidationSchema),
  SubscriptionController.updateAgentCount
);

// Cancel subscription
router.post(
  "/:subscriptionId/cancel",
  auth(UserRole.organization_admin, UserRole.super_admin),
  SubscriptionController.cancelSubscription
);

// Delete subscription (admin only)
router.delete(
  "/:subscriptionId",
  auth(UserRole.super_admin),
  SubscriptionController.deleteSubscription
);

// Stripe webhook
router.post(
  "/stripe/webhook",
  // verifyStripeWebhook, // Uncomment when you set up webhook signature verification
  SubscriptionController.handleStripeWebhook
);

export const SubscriptionRoutes = router;
