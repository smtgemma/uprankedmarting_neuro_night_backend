import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import {
  ICancelSubscriptionRequest,
  ICreateSubscriptionRequest,
} from "./subscription.interface";
import { stripe } from "../../utils/stripe";
import { SubscriptionStatus } from "@prisma/client";

const createSubscription = async (
  orgId: string,
  payload: ICreateSubscriptionRequest
) => {
  console.log(
    "Creating subscription for org:",
    orgId,
    "with plan:",
    payload.planId
  );

  const plan = await prisma.plan.findUnique({
    where: { id: payload.planId, isActive: true, isDeleted: false },
  });

  console.log(
    "Plan found:",
    plan
      ? {
          id: plan.id,
          name: plan.name,
          planLevel: plan.planLevel,
          defaultAgents: plan.defaultAgents,
          stripePriceId: plan.stripePriceId,
        }
      : null
  );

  if (!plan) throw new AppError(status.NOT_FOUND, "Plan not found or inactive");
  if (!plan.planLevel) {
    throw new AppError(
      status.BAD_REQUEST,
      "Plan is missing planLevel configuration"
    );
  }

  // Include owner to get email
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscriptions: true,
      ownedOrganization: true, // Include owner details
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

    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }],
      trial_period_days:
        plan.trialDays > 0 && !org.hasUsedTrial ? plan.trialDays : undefined,
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
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

    console.log("Creating subscription in DB with data:", {
      organizationId: orgId,
      planId: plan.id,
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId,
      status: dbStatus,
      planLevel: plan.planLevel,
      numberOfAgents: plan.defaultAgents,
    });

    const subscription = await prisma.subscription.create({
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
        numberOfAgents: plan.defaultAgents,
      },
      include: { plan: true, organization: true },
    });

    console.log("Subscription created successfully in DB:", subscription.id);

    // Mark trial used
    if (plan.trialDays > 0 && !org.hasUsedTrial) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { hasUsedTrial: true },
      });
    }

    return {
      subscription,
      clientSecret,
      message: `Subscription created. ${
        plan.trialDays > 0 && !org.hasUsedTrial
          ? `${plan.trialDays}-day trial started.`
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
const handleWebhook = async (rawBody: Buffer, signature: string) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    throw new AppError(400, `Webhook Error: ${err.message}`);
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) return { received: true };

  const STATUS_MAP: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELED,
    unpaid: SubscriptionStatus.UNPAID,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  };

  if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  ) {
    const sub = event.data.object as any;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: STATUS_MAP[sub.status] || SubscriptionStatus.INCOMPLETE,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      },
    });
  }

  await prisma.webhookEvent.create({
    data: { id: event.id, type: event.type },
  });
  return { received: true };
};

export const SubscriptionService = {
  createSubscription,
  getOrgSubscriptions,
  cancelSubscription,
  resumeSubscription,
  handleWebhook,
};
