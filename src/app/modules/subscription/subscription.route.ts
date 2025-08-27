// import { Router } from "express";
// import { UserRole } from "@prisma/client";
// import auth from "../../middlewares/auth";
// import validateRequest from "../../middlewares/validateRequest";
// import { SubscriptionController } from "./subscription.controller";
// import { SubscriptionValidation } from "./subscription.validation";
// import { verifyStripeWebhook } from "../../utils/stripeWebhook";

// const router = Router();

// router.post(
//   "/create-subscription",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   validateRequest(SubscriptionValidation.SubscriptionValidationSchema),
//   SubscriptionController.createSubscription
// );

// router.get(
//   "/my-subscription",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   SubscriptionController.getMySubscription
// );

// router.get(
//   "/",
//   auth(UserRole.super_admin),
//   SubscriptionController.getAllSubscription
// );

// router.get(
//   "/:subscriptionId",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   SubscriptionController.getSingleSubscription
// );

// router.put(
//   "/:subscriptionId",
//   auth(UserRole.super_admin),
//   validateRequest(SubscriptionValidation.UpdateSubscriptionValidationSchema),
//   SubscriptionController.updateSubscription
// );

// router.delete(
//   "/:subscriptionId",
//   auth(UserRole.super_admin),
//   SubscriptionController.deleteSubscription
// );

// // router.post("/stripe/webhook", SubscriptionController.handleStripeWebhook);
// // Add this middleware to the webhook route
// router.post(
//   "/stripe/webhook",
//   verifyStripeWebhook,
//   SubscriptionController.handleStripeWebhook
// );

// export const SubscriptionRoutes = router;

import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionValidation } from "./subscription.validation";
import { verifyStripeWebhook } from "../../utils/stripeWebhook";
// import { verifyStripeWebhook } from "../../utils/stripeWebhook";

const router = Router();

router.post(
  "/create-subscription",
  auth(UserRole.organization_admin),
  validateRequest(SubscriptionValidation.SubscriptionValidationSchema),
  SubscriptionController.createSubscription
);

router.get(
  "/my-subscription",
  auth(),
  SubscriptionController.getMySubscription
);

router.get("/", auth(), SubscriptionController.getAllSubscription);

router.get(
  "/:subscriptionId",
  auth(),
  SubscriptionController.getSingleSubscription
);

router.put(
  "/:subscriptionId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  SubscriptionController.updateSubscription
);

router.delete(
  "/:subscriptionId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  SubscriptionController.deleteSubscription
);

router.post(
  "/stripe/webhook",
  verifyStripeWebhook,
  SubscriptionController.handleStripeWebhook
);

export const SubscriptionRoutes = router;
