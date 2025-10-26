import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import { stripe } from "../../utils/stripe";
import QueryBuilder from "../../builder/QueryBuilder";
import Stripe from "stripe";
import {
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handleSubscriptionTrialWillEnd,
  handleSubscriptionUpdated,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
} from "../../utils/webhook";
import {
  PlanLevel,
  Subscription,
  SubscriptionStatus,
  PaymentStatus,
} from "@prisma/client";
import axios from "axios";
import config from "../../config";

// Calculate trial end date (1 day from now)
const calculateTrialEndDate = (): Date => {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 1); // 1 day trial
  return trialEnd;
};

// Calculate subscription end date based on plan interval
const calculateEndDate = (
  startDate: Date,
  interval: string,
  intervalCount: number
): Date => {
  const endDate = new Date(startDate);

  switch (interval) {
    case "day":
      endDate.setDate(endDate.getDate() + intervalCount);
      break;
    case "week":
      endDate.setDate(endDate.getDate() + 7 * intervalCount);
      break;
    case "month":
      endDate.setMonth(endDate.getMonth() + intervalCount);
      if (endDate.getDate() !== startDate.getDate()) {
        endDate.setDate(0);
      }
      break;
    case "year":
      endDate.setFullYear(endDate.getFullYear() + intervalCount);
      break;
    default:
      throw new AppError(
        status.BAD_REQUEST,
        `Unsupported interval: ${interval}`
      );
  }

  return endDate;
};

// Calculate final amount based on plan and agents
const calculateSubscriptionAmount = (
  plan: any,
  planLevel: PlanLevel,
  numberOfAgents: number
): number => {
  if (planLevel === PlanLevel.only_ai) {
    return plan.amount;
  }

  if (
    planLevel === PlanLevel.only_real_agent ||
    planLevel === PlanLevel.ai_then_real_agent
  ) {
    // If requesting more than default agents, calculate extra cost
    if (numberOfAgents > plan.defaultAgents) {
      const extraAgents = numberOfAgents - plan.defaultAgents;
      const extraAgentPricing = plan.extraAgentPricing as any[];

      // Find pricing tier for extra agents
      const pricingTier = extraAgentPricing?.find(
        (tier) => tier.agents === extraAgents
      );

      if (pricingTier) {
        return plan.amount + pricingTier.price / 100; // Convert from cents
      }

      // If no exact tier, calculate proportionally
      return plan.amount + extraAgents * (plan.amount / plan.defaultAgents);
    }

    return plan.amount;
  }

  throw new AppError(status.BAD_REQUEST, "Invalid plan level");
};

// Helper: Get or create Stripe customer
const getOrCreateStripeCustomer = async (
  organization: any
): Promise<string> => {
  // You may need to add stripeCustomerId field to Organization model
  // For now, we'll create a new customer each time
  // In production, you should store and reuse the customer ID

  const customer = await stripe.customers.create({
    email: organization.ownedOrganization?.email,
    name: organization.name,
    metadata: {
      organizationId: organization.id,
    },
  });

  return customer.id;
};

// const createSubscription = async (
//   organizationId: string,
//   planId: string,
//   planLevel: PlanLevel,
//   purchasedNumber: string,
//   sid: string,
//   numberOfAgents: number
// ) => {
//   return await prisma.$transaction(
//     async (tx) => {
//       // 1. Verify organization
//       const organization = await tx.organization.findUnique({
//         where: { id: organizationId },
//         include: {
//           ownedOrganization: true,
//         },
//       });

//       if (!organization) {
//         throw new AppError(status.NOT_FOUND, "Organization not found");
//       }

//       // 2. Check for existing active subscriptions
//       const existingActiveSubscription = await tx.subscription.findFirst({
//         where: {
//           organizationId,
//           status: {
//             in: [
//               SubscriptionStatus.ACTIVE,
//               SubscriptionStatus.TRIALING,
//               SubscriptionStatus.PAST_DUE,
//               SubscriptionStatus.INCOMPLETE,
//             ],
//           },
//         },
//       });

//       if (existingActiveSubscription) {
//         throw new AppError(
//           status.BAD_REQUEST,
//           "Organization already has an active subscription"
//         );
//       }

//       // 3. Verify plan
//       const plan = await tx.plan.findUnique({ where: { id: planId } });
//       if (!plan) {
//         throw new AppError(status.NOT_FOUND, "Plan not found");
//       }

//       // 4. Validate number of agents
//       const agentCount = numberOfAgents || plan.defaultAgents;

//       if (planLevel === PlanLevel.only_ai && agentCount > 0) {
//         throw new AppError(
//           status.BAD_REQUEST,
//           "AI-only plans do not support agents"
//         );
//       }

//       // 5. Validate phone number
//       let normalizedPhone = purchasedNumber.startsWith("+")
//         ? purchasedNumber
//         : `+${purchasedNumber}`;

//       const availableNumber = await tx.availableTwilioNumber.findFirst({
//         where: {
//           OR: [
//             { phoneNumber: normalizedPhone },
//             { phoneNumber: normalizedPhone.replace("+", "") },
//           ],
//         },
//       });

//       if (!availableNumber) {
//         throw new AppError(
//           status.NOT_FOUND,
//           `Phone number ${purchasedNumber} is not available`
//         );
//       }

//       if (availableNumber.isPurchased) {
//         throw new AppError(
//           status.BAD_REQUEST,
//           `Phone number ${purchasedNumber} is already purchased`
//         );
//       }

//       // 6. Calculate amounts and dates
//       const startDate = new Date();
//       const trialEndDate = calculateTrialEndDate();
//       const finalAmount = calculateSubscriptionAmount(
//         plan,
//         planLevel,
//         agentCount
//       );

//       console.log("Creating subscription with:", {
//         organizationId,
//         planId,
//         planLevel,
//         agentCount,
//         finalAmount,
//         trialEndDate,
//       });

//       // 7. Create Stripe subscription with trial
//       const stripeCustomerId = await getOrCreateStripeCustomer(organization);

//       const stripeSubscription = await stripe.subscriptions.create({
//         customer: stripeCustomerId,
//         items: [
//           {
//             price: plan.priceId,
//             quantity: planLevel === PlanLevel.only_ai ? 1 : agentCount,
//           },
//         ],
//         trial_end: Math.floor(trialEndDate.getTime() / 1000),
//         payment_behavior: "default_incomplete",
//         payment_settings: {
//           payment_method_types: ["card"],
//           save_default_payment_method: "on_subscription",
//         },
//         expand: ["latest_invoice.payment_intent"], // This expands the payment_intent
//         metadata: {
//           organizationId,
//           planId,
//           numberOfAgents: agentCount.toString(),
//           purchasedNumber: availableNumber.phoneNumber,
//           planLevel,
//           sid,
//         },
//       });

//       // Type assertion to handle the expanded invoice
//       const latestInvoice =
//         stripeSubscription.latest_invoice as Stripe.Invoice & {
//           payment_intent?: Stripe.PaymentIntent;
//         };
//       const paymentIntent = latestInvoice?.payment_intent;

//       console.log("Stripe subscription created:", {
//         subscriptionId: stripeSubscription.id,
//         customerId: stripeCustomerId,
//         paymentIntentId: paymentIntent?.id,
//       });

//       // 8. Create subscription record
//       const subscription = await tx.subscription.create({
//         data: {
//           organizationId,
//           planId,
//           startDate,
//           trialEndDate,
//           endDate: calculateEndDate(
//             trialEndDate,
//             plan.interval,
//             plan.intervalCount
//           ),
//           amount: finalAmount,
//           stripePaymentId: paymentIntent?.id || null,
//           stripeSubscriptionId: stripeSubscription.id,
//           paymentStatus: PaymentStatus.PENDING,
//           status: SubscriptionStatus.TRIALING,
//           planLevel,
//           purchasedNumber: availableNumber.phoneNumber,
//           sid,
//           numberOfAgents: agentCount,
//           isTrialUsed: true,
//         },
//       });

//       console.log("Database subscription created:", subscription.id);

//       // 9. Update organization
//       await tx.organization.update({
//         where: { id: organizationId },
//         data: {
//           hasUsedTrial: true,
//           organizationNumber: availableNumber.phoneNumber,
//         },
//       });

//       // 10. Reserve the phone number during trial
//       await tx.availableTwilioNumber.update({
//         where: { phoneNumber: availableNumber.phoneNumber },
//         data: {
//           requestedByOrgId: organizationId,
//         },
//       });

//       console.log("Phone number reserved:", availableNumber.phoneNumber);

//       return {
//         subscription,
//         clientSecret: paymentIntent?.client_secret,
//         subscriptionId: stripeSubscription.id,
//         trialEndDate,
//       };
//     },
//     { timeout: 10000 }
//   );
// };

// Upgrade/Downgrade plan

// =============================
// CREATE SUBSCRIPTION (TRIAL + CARD REQUIRED)
// =============================

const createSubscription = async (
  organizationId: string,
  planId: string,
  planLevel: PlanLevel,
  purchasedNumber: string,
  sid: string,
  numberOfAgents: number
) => {
  // === 1. VALIDATE & FETCH DATA (OUTSIDE TX) ===
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { ownedOrganization: true },
  });
  if (!organization) throw new AppError(status.NOT_FOUND, "Organization not found");

  const existingSub = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
    },
  });
  if (existingSub) throw new AppError(status.BAD_REQUEST, "Active subscription exists");

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found");

  const agentCount = numberOfAgents || plan.defaultAgents;
  if (planLevel === PlanLevel.only_ai && agentCount > 0) {
    throw new AppError(status.BAD_REQUEST, "AI-only plans do not support agents");
  }

  const normalizedPhone = purchasedNumber.startsWith("+") ? purchasedNumber : `+${purchasedNumber}`;
  const twilioNumber = await prisma.availableTwilioNumber.findFirst({
    where: { phoneNumber: normalizedPhone },
  });
  if (!twilioNumber) throw new AppError(status.NOT_FOUND, "Phone number not available");
  if (twilioNumber.isPurchased) throw new AppError(status.BAD_REQUEST, "Phone number already purchased");

  const trialEndDate = calculateTrialEndDate();
  const amount = calculateSubscriptionAmount(plan, planLevel, agentCount);

  // === 2. CREATE STRIPE SUBSCRIPTION + SETUP INTENT (OUTSIDE TX) ===
  const stripeCustomerId = await getOrCreateStripeCustomer(organization);

  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{
      price: plan.priceId,
      quantity: planLevel === PlanLevel.only_ai ? 1 : agentCount,
    }],
    trial_end: Math.floor(trialEndDate.getTime() / 1000),
    payment_behavior: "default_incomplete",
    payment_settings: {
      payment_method_types: ["card"],
      save_default_payment_method: "on_subscription",
    },
    expand: ["pending_setup_intent"],
    metadata: {
      organizationId,
      planId,
      planLevel,
      purchasedNumber: normalizedPhone,
      sid,
      numberOfAgents: agentCount.toString(),
    },
  });

  const setupIntent = stripeSubscription.pending_setup_intent as Stripe.SetupIntent;
  if (!setupIntent?.client_secret) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create SetupIntent");
  }

  // === 3. WRITE TO DB (FAST TRANSACTION) ===
  return await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        organizationId,
        planId,
        startDate: new Date(),
        trialEndDate,
        endDate: calculateEndDate(trialEndDate, plan.interval, plan.intervalCount),
        amount,
        stripeSubscriptionId: stripeSubscription.id,
        stripePaymentId: null,
        paymentStatus: PaymentStatus.PENDING,
        status: SubscriptionStatus.TRIALING,
        planLevel,
        purchasedNumber: normalizedPhone,
        sid,
        numberOfAgents: agentCount,
        isTrialUsed: true,
      },
    });

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        hasUsedTrial: true,
        organizationNumber: normalizedPhone,
      },
    });

    await tx.availableTwilioNumber.update({
      where: { phoneNumber: normalizedPhone },
      data: { requestedByOrgId: organizationId },
    });

    return {
      subscription,
      clientSecret: setupIntent.client_secret,
      subscriptionId: stripeSubscription.id,
      trialEndDate,
    };
  }, { timeout: 10000 });
};

const changePlan = async (
  subscriptionId: string,
  newPlanId: string,
  numberOfAgents?: number
) => {
  return await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new AppError(status.NOT_FOUND, "Subscription not found");
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new AppError(
        status.BAD_REQUEST,
        "Can only change active subscriptions"
      );
    }

    const newPlan = await tx.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan) {
      throw new AppError(status.NOT_FOUND, "New plan not found");
    }

    // Validate plan level compatibility
    if (subscription.planLevel !== newPlan.planLevel) {
      throw new AppError(
        status.BAD_REQUEST,
        "Cannot change to a plan with different plan level. Please cancel and create a new subscription."
      );
    }

    // Calculate new amount
    const agentCount =
      numberOfAgents || subscription.numberOfAgents || newPlan.defaultAgents;
    const newAmount = calculateSubscriptionAmount(
      newPlan,
      subscription.planLevel,
      agentCount
    );

    console.log("Changing plan:", {
      oldPlanId: subscription.planId,
      newPlanId,
      oldAmount: subscription.amount,
      newAmount,
      agentCount,
    });

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId!
    );

    // Update Stripe subscription
    await stripe.subscriptions.update(subscription.stripeSubscriptionId!, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPlan.priceId,
          quantity:
            subscription.planLevel === PlanLevel.only_ai ? 1 : agentCount,
        },
      ],
      proration_behavior: "always_invoice", // Charge/credit difference immediately
      metadata: {
        ...stripeSubscription.metadata,
        planId: newPlanId,
        numberOfAgents: agentCount.toString(),
      },
    });

    // Update database
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        numberOfAgents: agentCount,
        amount: newAmount,
      },
    });

    console.log("Plan changed successfully");

    return updatedSubscription;
  });
};

// Change number of agents
const updateAgentCount = async (
  subscriptionId: string,
  numberOfAgents: number
) => {
  return await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new AppError(status.NOT_FOUND, "Subscription not found");
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new AppError(
        status.BAD_REQUEST,
        "Can only update agents for active subscriptions"
      );
    }

    if (subscription.planLevel === PlanLevel.only_ai) {
      throw new AppError(
        status.BAD_REQUEST,
        "AI-only plans don't support agents"
      );
    }

    if (numberOfAgents < 1) {
      throw new AppError(
        status.BAD_REQUEST,
        "Number of agents must be at least 1"
      );
    }

    const newAmount = calculateSubscriptionAmount(
      subscription.plan!,
      subscription.planLevel,
      numberOfAgents
    );

    console.log("Updating agent count:", {
      subscriptionId,
      oldAgentCount: subscription.numberOfAgents,
      newAgentCount: numberOfAgents,
      oldAmount: subscription.amount,
      newAmount,
    });

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId!
    );

    // Update Stripe subscription quantity
    await stripe.subscriptions.update(subscription.stripeSubscriptionId!, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          quantity: numberOfAgents,
        },
      ],
      proration_behavior: "always_invoice",
      metadata: {
        ...stripeSubscription.metadata,
        numberOfAgents: numberOfAgents.toString(),
      },
    });

    // Update database
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        numberOfAgents,
        amount: newAmount,
      },
    });

    console.log("Agent count updated successfully");

    return updatedSubscription;
  });
};

// Cancel subscription
const cancelSubscription = async (subscriptionId: string) => {
  return await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new AppError(status.NOT_FOUND, "Subscription not found");
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new AppError(
        status.BAD_REQUEST,
        "Subscription is already canceled"
      );
    }

    console.log("Canceling subscription:", subscriptionId);

    // Cancel in Stripe
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    // Update database
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELED,
        endDate: new Date(),
      },
    });

    // If subscription was in trial, release the phone number
    if (subscription.status === SubscriptionStatus.TRIALING) {
      let phoneNumber = subscription.purchasedNumber;
      if (!phoneNumber.startsWith("+")) {
        phoneNumber = `+${phoneNumber}`;
      }

      await tx.availableTwilioNumber.update({
        where: { phoneNumber: phoneNumber },
        data: {
          requestedByOrgId: null,
        },
      });

      console.log("Released phone number from trial subscription");
    }

    console.log("Subscription canceled successfully");

    return updatedSubscription;
  });
};

const getAllSubscription = async (query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(prisma.subscription, query);
  const subscription = await queryBuilder
    .search([""])
    .paginate()
    .fields()
    .include({
      organization: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          industry: true,
          address: true,
          websiteLink: true,
          ownerId: true,
          ownedOrganization: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              trialEndDate: true,
              amount: true,
              paymentStatus: true,
              status: true,
              planLevel: true,
              purchasedNumber: true,
              numberOfAgents: true,
            },
          },
        },
      },
      plan: true,
    })
    .execute();

  const meta = await queryBuilder.countTotal();
  return { meta, data: subscription };
};

const getSingleSubscription = async (subscriptionId: string) => {
  const result = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          hasUsedTrial: true,
        },
      },
      plan: true,
    },
  });

  if (!result) {
    throw new AppError(status.NOT_FOUND, "Subscription not found!");
  }

  return result;
};

const getMySubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ownedOrganization: true },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const organizationId = user.ownedOrganization?.id;
  if (!organizationId) {
    throw new AppError(
      status.NOT_FOUND,
      "User is not associated with an organization"
    );
  }

  const result = await prisma.subscription.findFirst({
    where: { organizationId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          industry: true,
          address: true,
          websiteLink: true,
          ownerId: true,
          hasUsedTrial: true,
          ownedOrganization: true,
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              trialEndDate: true,
              amount: true,
              paymentStatus: true,
              status: true,
              planLevel: true,
              purchasedNumber: true,
              numberOfAgents: true,
            },
          },
        },
      },
      plan: true,
    },
  });

  if (!result) {
    throw new AppError(
      status.NOT_FOUND,
      "Subscription not found for this organization"
    );
  }

  return result;
};

const updateSubscription = async (
  subscriptionId: string,
  data: Partial<Subscription>
) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  const result = await prisma.subscription.update({
    where: { id: subscriptionId },
    data,
  });

  return result;
};

const deleteSubscription = async (subscriptionId: string) => {
  return cancelSubscription(subscriptionId);
};

// const HandleStripeWebhook = async (event: Stripe.Event) => {
//   try {
//     console.log(`Processing webhook event: ${event.type}`);

//     switch (event.type) {
//       // Subscription lifecycle events
//       case "customer.subscription.trial_will_end":
//         await handleSubscriptionTrialWillEnd(event.data.object as Stripe.Subscription);
//         break;

//       case "customer.subscription.updated":
//         await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
//         break;

//       case "customer.subscription.deleted":
//         await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
//         break;

//       // Invoice events (primary payment handlers)
//       case "invoice.payment_succeeded":
//         await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
//         break;

//       case "invoice.payment_failed":
//         await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
//         break;

//       // Legacy payment intent events (for backward compatibility)
//       case "payment_intent.succeeded":
//         await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
//         break;

//       case "payment_intent.payment_failed":
//         await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
//         break;

//       default:
//         console.log(`Unhandled event type: ${event.type}`);
//     }

//     return { received: true };
//   } catch (error) {
//     console.error("Error handling Stripe webhook:", error);
//     throw new AppError(status.INTERNAL_SERVER_ERROR, "Webhook handling failed");
//   }
// };

const HandleStripeWebhook = async (event: Stripe.Event) => {
  try {
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      // ============================================
      // SUBSCRIPTION LIFECYCLE EVENTS (CRITICAL)
      // ============================================
      case "customer.subscription.created":
        console.log("New subscription created:", event.data.object.id);
        // Usually handled by createSubscription, but good for logging
        break;

      case "customer.subscription.trial_will_end":
        await handleSubscriptionTrialWillEnd(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      // ============================================
      // INVOICE EVENTS (CRITICAL for recurring billing)
      // ============================================
      case "invoice.created":
        console.log("Invoice created:", event.data.object.id);
        // Log for tracking purposes
        break;

      case "invoice.finalized":
        console.log("Invoice finalized:", event.data.object.id);
        // Invoice is ready to be paid
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // ============================================
      // PAYMENT INTENT EVENTS (Legacy/Backup)
      // ============================================
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      // ============================================
      // CUSTOMER EVENTS (Optional but useful)
      // ============================================
      case "customer.created":
        console.log("Customer created:", event.data.object.id);
        break;

      case "customer.updated":
        console.log("Customer updated:", event.data.object.id);
        break;

      case "customer.deleted":
        console.log("Customer deleted:", event.data.object.id);
        break;

      // ============================================
      // PAYMENT METHOD EVENTS (Optional)
      // ============================================
      case "payment_method.attached":
        console.log("Payment method attached:", event.data.object.id);
        break;

      case "payment_method.detached":
        console.log("Payment method detached:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Webhook handling failed");
  }
};

export const SubscriptionServices = {
  createSubscription,
  getAllSubscription,
  getSingleSubscription,
  getMySubscription,
  updateSubscription,
  deleteSubscription,
  HandleStripeWebhook,
  changePlan,
  updateAgentCount,
  cancelSubscription,
};
