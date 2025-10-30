import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import {
  ICancelSubscriptionRequest,
  ICreateSubscriptionRequest,
} from "./subscription.interface";
import { stripe } from "../../utils/stripe";
import { SubscriptionStatus } from "@prisma/client";
import config from "../../config";

const createSubscription = async (
  orgId: string,
  payload: ICreateSubscriptionRequest
) => {
  console.log(
    "Creating subscription for org:",
    orgId,
    "with plan:",
    payload.planId,
    "extraAgents:",
    payload.extraAgents,
    "purchasedNumber:",
    payload.purchasedNumber
  );

  const plan = await prisma.plan.findUnique({
    where: { id: payload.planId, isActive: true, isDeleted: false },
  });

  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found or inactive");
  if (!plan.planLevel) {
    throw new AppError(
      status.BAD_REQUEST,
      "Plan is missing planLevel configuration"
    );
  }

  // Validate extra agents for non-AI plans
  if (
    plan.planLevel !== "only_ai" &&
    payload.extraAgents &&
    payload.extraAgents > 0
  ) {
    if (!plan.extraAgentPricing) {
      throw new AppError(
        status.BAD_REQUEST,
        "Extra agent pricing not configured for this plan"
      );
    }

    const extraPricing = plan.extraAgentPricing as any[];
    const selectedPricing = extraPricing.find(
      (p) => p.agents === payload.extraAgents
    );
    if (!selectedPricing) {
      throw new AppError(
        status.BAD_REQUEST,
        "Invalid number of extra agents selected"
      );
    }
  }

  // Validate phone number purchase
  if (payload.purchasedNumber && payload.sid) {
    const existingNumber = await prisma.availableTwilioNumber.findFirst({
      where: {
        phoneNumber: payload.purchasedNumber,
        isPurchased: true,
      },
    });

    if (existingNumber) {
      throw new AppError(
        status.CONFLICT,
        "Phone number already purchased by another organization"
      );
    }
  }

  // Include owner to get email
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscriptions: true,
      ownedOrganization: true,
    },
  });
  if (!org) throw new AppError(status.NOT_FOUND, "Organization not found");
  if (!org.ownedOrganization) {
    throw new AppError(status.BAD_REQUEST, "Organization owner not found");
  }

  // Prevent multiple active subs
  const activeSub = org.subscriptions.find((s) =>
    ["ACTIVE", "TRIALING"].includes(s.status)
  );
  if (activeSub) {
    throw new AppError(
      status.CONFLICT,
      "Organization already has an active subscription"
    );
  }

  // Trial check
  if (org.hasUsedTrial && plan.trialDays > 0) {
    throw new AppError(status.BAD_REQUEST, "Trial already used");
  }

  let stripeSubscriptionId: string | null = null;

  try {
    // Calculate total price
    let totalPrice = plan.price;
    let extraAgentPrice = 0;

    if (
      plan.planLevel !== "only_ai" &&
      payload.extraAgents &&
      payload.extraAgents > 0
    ) {
      const extraPricing = plan.extraAgentPricing as any[];
      const selectedPricing = extraPricing.find(
        (p) => p.agents === payload.extraAgents
      );
      if (selectedPricing) {
        extraAgentPrice = selectedPricing.price;
        totalPrice += extraAgentPrice;
      }
    }

    console.log("Price calculation:", {
      basePrice: plan.price,
      extraAgents: payload.extraAgents,
      extraAgentPrice,
      totalPrice,
      totalMinuteLimit: plan.totalMinuteLimit,
    });

    let stripeCustomerId = org.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: org.ownedOrganization.email,
        name: org.name,
        metadata: {
          orgId,
          ownerId: org.ownerId,
        },
      });
      stripeCustomerId = customer.id;
      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId },
      });
    }

    await stripe.paymentMethods.attach(payload.paymentMethodId, {
      customer: stripeCustomerId,
    });

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: payload.paymentMethodId },
    });

    // Create subscription with calculated price
    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }], // Base plan price
      trial_period_days:
        plan.trialDays > 0 && !org.hasUsedTrial ? plan.trialDays : undefined,
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        extraAgents: payload.extraAgents?.toString() || "0",
        extraAgentPrice: extraAgentPrice.toString(),
        purchasedNumber: payload.purchasedNumber || "",
        totalMinuteLimit: plan.totalMinuteLimit?.toString() || "0",
      },
    });

    stripeSubscriptionId = stripeSub.id;

    const invoice = stripeSub.latest_invoice as any;
    const clientSecret = invoice?.payment_intent?.client_secret || null;

    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    };

    const dbStatus =
      statusMap[stripeSub.status] || SubscriptionStatus.INCOMPLETE;

    // Calculate total agents (default + extra)
    const totalAgents =
      plan.planLevel === "only_ai"
        ? 0
        : plan.defaultAgents + (payload.extraAgents || 0);

    console.log("Creating subscription in DB with data:", {
      organizationId: orgId,
      planId: plan.id,
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId,
      status: dbStatus,
      planLevel: plan.planLevel,
      numberOfAgents: totalAgents,
      totalMinuteLimit: plan.totalMinuteLimit,
      purchasedNumber: payload.purchasedNumber,
      sid: payload.sid,
    });

    // Start transaction for multiple database operations
    const result = await prisma.$transaction(async (tx) => {
      // Update organization with purchased number
      if (payload.purchasedNumber && payload.sid) {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            purchasedPhoneNumber: payload.purchasedNumber,
            purchasedNumberSid: payload.sid,
          },
        });

        // Mark phone number as purchased
        await tx.availableTwilioNumber.updateMany({
          where: {
            phoneNumber: payload.purchasedNumber,
            sid: payload.sid,
          },
          data: {
            isPurchased: true,
            purchasedByOrgId: orgId,
            purchasedAt: new Date(),
          },
        });
      }

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          organizationId: orgId,
          planId: plan.id,
          stripeSubscriptionId: stripeSub.id,
          stripeCustomerId,
          status: dbStatus,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          trialStart: stripeSub.trial_start
            ? new Date(stripeSub.trial_start * 1000)
            : null,
          trialEnd: stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000)
            : null,
          planLevel: plan.planLevel,
          numberOfAgents: totalAgents,
          totalMinuteLimit: plan.totalMinuteLimit, // Include totalMinuteLimit
          purchasedNumber: payload.purchasedNumber,
          sid: payload.sid,
        },
        include: { plan: true, organization: true },
      });

      return subscription;
    });

    console.log("Subscription created successfully in DB:", result.id);

    // Mark trial used
    if (plan.trialDays > 0 && !org.hasUsedTrial) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { hasUsedTrial: true },
      });
    }

    return {
      subscription: result,
      clientSecret,
      message: `Subscription created. ${
        plan.trialDays > 0 && !org.hasUsedTrial
          ? `${plan.trialDays}-day trial started.`
          : ""
      }${
        payload.extraAgents ? ` Added ${payload.extraAgents} extra agents.` : ""
      }${
        payload.purchasedNumber
          ? ` Purchased phone number: ${payload.purchasedNumber}`
          : ""
      }${
        plan.totalMinuteLimit
          ? ` Monthly minute limit: ${plan.totalMinuteLimit}`
          : ""
      }`,
    };
  } catch (err: any) {
    console.error("Subscription creation error:", err);

    // Rollback Stripe subscription if DB save fails
    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
        console.log("Rolled back Stripe subscription:", stripeSubscriptionId);
      } catch (cancelErr) {
        console.error("Failed to cancel Stripe subscription:", cancelErr);
      }
    }

    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to create subscription: ${err.message}`
    );
  }
};

const getOrgSubscriptions = async (orgId: string) => {
  return await prisma.subscription.findMany({
    where: { organizationId: orgId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
};

const cancelSubscription = async (
  orgId: string,
  payload: ICancelSubscriptionRequest
) => {
  const sub = await prisma.subscription.findFirst({
    where: { id: payload.subscriptionId, organizationId: orgId },
  });
  if (!sub) throw new AppError(status.NOT_FOUND, "Subscription not found");

  try {
    const stripeSub = await stripe.subscriptions.update(
      sub.stripeSubscriptionId,
      { cancel_at_period_end: payload.cancelAtPeriodEnd ?? true }
    );

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? true,
        canceledAt: payload.cancelAtPeriodEnd ? null : new Date(),
        status: payload.cancelAtPeriodEnd
          ? sub.status
          : SubscriptionStatus.CANCELED,
      },
      include: { plan: true },
    });

    return updated;
  } catch (err: any) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, err.message);
  }
};

const resumeSubscription = async (orgId: string, subscriptionId: string) => {
  const sub = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      organizationId: orgId,
      cancelAtPeriodEnd: true,
    },
  });
  if (!sub) throw new AppError(status.BAD_REQUEST, "No subscription to resume");

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
    include: { plan: true },
  });
};

// Webhook (idempotent)
// const handleWebhook = async (rawBody: Buffer, signature: string) => {
//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(
//       rawBody,
//       signature,
//       process.env.STRIPE_WEBHOOK_SECRET!
//     );
//   } catch (err: any) {
//     throw new AppError(400, `Webhook Error: ${err.message}`);
//   }

//   const existing = await prisma.webhookEvent.findUnique({
//     where: { id: event.id },
//   });
//   if (existing) return { received: true };

//   const STATUS_MAP: Record<string, SubscriptionStatus> = {
//     active: SubscriptionStatus.ACTIVE,
//     trialing: SubscriptionStatus.TRIALING,
//     past_due: SubscriptionStatus.PAST_DUE,
//     canceled: SubscriptionStatus.CANCELED,
//     unpaid: SubscriptionStatus.UNPAID,
//     incomplete: SubscriptionStatus.INCOMPLETE,
//     incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
//   };

//   if (
//     [
//       "customer.subscription.created",
//       "customer.subscription.updated",
//       "customer.subscription.deleted",
//     ].includes(event.type)
//   ) {
//     const sub = event.data.object as any;
//     await prisma.subscription.updateMany({
//       where: { stripeSubscriptionId: sub.id },
//       data: {
//         status: STATUS_MAP[sub.status] || SubscriptionStatus.INCOMPLETE,
//         currentPeriodStart: new Date(sub.current_period_start * 1000),
//         currentPeriodEnd: new Date(sub.current_period_end * 1000),
//         trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
//         trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
//         cancelAtPeriodEnd: sub.cancel_at_period_end,
//         canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
//       },
//     });
//   }

//   await prisma.webhookEvent.create({
//     data: { id: event.id, type: event.type },
//   });
//   return { received: true };
// };

const handleWebhook = async (rawBody: Buffer, signature: string) => {
  // console.log('Webhook received - starting processing');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    // console.log('Webhook signature verified:', event.type, event.id);
  } catch (err: any) {
    // console.error('Webhook signature verification failed:', err.message);
    throw new AppError(400, `Webhook Error: ${err.message}`);
  }

  // Check if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    // console.log(`Webhook ${event.id} already processed, skipping`);
    return { received: true };
  }

  const STATUS_MAP: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELED,
    unpaid: SubscriptionStatus.UNPAID,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  };

  try {
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      const stripeSubscription = event.data.object as any;
      // console.log(`Processing subscription: ${stripeSubscription.id}, Status: ${stripeSubscription.status}`);

      // DEBUG: Log the subscription data to see what fields are available
      // console.log('Stripe subscription data:', {
      //   current_period_start: stripeSubscription.current_period_start,
      //   current_period_end: stripeSubscription.current_period_end,
      //   trial_start: stripeSubscription.trial_start,
      //   trial_end: stripeSubscription.trial_end,
      //   status: stripeSubscription.status
      // });

      // FIX: Create safe date conversion function
      const createSafeDate = (
        timestamp: number | null | undefined
      ): Date | null => {
        if (!timestamp || typeof timestamp !== "number") return null;
        try {
          return new Date(timestamp * 1000);
        } catch (error) {
          // console.error('Invalid timestamp:', timestamp);
          return null;
        }
      };

      // Prepare update data with safe date handling
      const updateData: any = {
        status:
          STATUS_MAP[stripeSubscription.status] ||
          SubscriptionStatus.INCOMPLETE,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        canceledAt: createSafeDate(stripeSubscription.canceled_at),
      };

      // Only add date fields if they are valid
      const currentPeriodStart = createSafeDate(
        stripeSubscription.current_period_start
      );
      const currentPeriodEnd = createSafeDate(
        stripeSubscription.current_period_end
      );
      const trialStart = createSafeDate(stripeSubscription.trial_start);
      const trialEnd = createSafeDate(stripeSubscription.trial_end);

      if (currentPeriodStart)
        updateData.currentPeriodStart = currentPeriodStart;
      if (currentPeriodEnd) updateData.currentPeriodEnd = currentPeriodEnd;
      if (trialStart) updateData.trialStart = trialStart;
      if (trialEnd) updateData.trialEnd = trialEnd;

      // console.log('Update data prepared:', updateData);

      // Update the subscription
      const updatedSubscription = await prisma.subscription.update({
        where: {
          stripeSubscriptionId: stripeSubscription.id,
        },
        data: updateData,
      });

      // console.log(`Successfully updated subscription: ${updatedSubscription.id}`);
    }

    // Store webhook event after successful processing
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        processed: true,
      },
    });

    // console.log('Webhook processing completed successfully');
    return { received: true };
  } catch (error: any) {
    // console.error('Error in webhook processing:', error);

    // Store the failed webhook for debugging
    await prisma.webhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        processed: false,
      },
    });

    // console.error(`Webhook processing failed but returning 200: ${error.message}`);
    return { received: true, error: error.message };
  }
};

export const SubscriptionService = {
  createSubscription,
  getOrgSubscriptions,
  cancelSubscription,
  resumeSubscription,
  handleWebhook,
};
