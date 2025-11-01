import status from "http-status";
import {
  ICancelSubscriptionRequest,
  ICreateSubscriptionRequest,
  ISwitchPlanRequest,
} from "./subscription.interface";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import { stripe } from "../../utils/stripe";
import { SubscriptionStatus } from "@prisma/client";
import { sendBillingEmail } from "../../utils/billing.email";

// --------------------------------------------------
//  Helper: Safe Stripe timestamp → Date
// --------------------------------------------------
const createSafeDate = (ts: number | null | undefined): Date | null => {
  if (!ts || typeof ts !== "number") return null;
  try {
    return new Date(ts * 1000);
  } catch {
    return null;
  }
};

// --------------------------------------------------
//  Helper: Convert cents to dollars
// --------------------------------------------------
const centsToDollars = (cents: number | null | undefined): number => {
  if (!cents) return 0;
  return cents / 100;
};

// --------------------------------------------------
//  Helper: Send Billing Notification
// --------------------------------------------------
const sendBillingNotification = async (
  orgId: string,
  invoiceData: any,
  type: "invoice" | "receipt" | "payment_failed" | "refund"
) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        ownedOrganization: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!org?.ownedOrganization?.email) {
      console.log("No email found for organization:", orgId);
      return;
    }

    const currentSub = org.subscriptions[0];
    const billingPeriod = currentSub
      ? `${new Date(
          currentSub.currentPeriodStart
        ).toLocaleDateString()} - ${new Date(
          currentSub.currentPeriodEnd
        ).toLocaleDateString()}`
      : undefined;

    await sendBillingEmail({
      to: org.ownedOrganization.email,
      customerName: org.ownedOrganization.name || org.name,
      invoiceNumber: invoiceData.number || `INV-${invoiceData.id.slice(-8)}`,
      amount: centsToDollars(invoiceData.total),
      currency: invoiceData.currency,
      dueDate: invoiceData.due_date
        ? new Date(invoiceData.due_date * 1000).toLocaleDateString()
        : undefined,
      billingPeriod,
      invoiceUrl: invoiceData.hosted_invoice_url,
      status: invoiceData.status as "paid" | "due" | "failed" | "refunded",
      type,
    });

    console.log(`Billing ${type} email sent to:`, org.ownedOrganization.email);
  } catch (error) {
    console.error("Failed to send billing email:", error);
    // Don't throw error - email failure shouldn't break webhook processing
  }
};

// --------------------------------------------------
//  createSubscription
// --------------------------------------------------
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

  let extraAgentPrice = 0;
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
    extraAgentPrice = selectedPricing.price;
  }

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

  const activeSub = org.subscriptions.find((s) =>
    ["ACTIVE", "TRIALING"].includes(s.status)
  );
  if (activeSub) {
    throw new AppError(
      status.CONFLICT,
      "Organization already has an active subscription"
    );
  }

  if (org.hasUsedTrial && plan.trialDays > 0) {
    throw new AppError(status.BAD_REQUEST, "Trial already used");
  }

  let stripeSubscriptionId: string | null = null;
  let customPriceId: string | null = null;

  try {
    const totalPrice = plan.price + extraAgentPrice;

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

    let subscriptionItems: any[] = [];

    if (extraAgentPrice > 0) {
      const customPrice = await stripe.prices.create({
        unit_amount: totalPrice * 100, // Stripe expects cents
        currency: plan.currency.toLowerCase(),
        recurring: {
          interval: plan.interval.toLowerCase() as any,
        },
        product: plan.stripeProductId,
        metadata: {
          planId: plan.id,
          basePrice: plan.price.toString(),
          extraAgents: payload.extraAgents?.toString() || "0",
          extraAgentPrice: extraAgentPrice.toString(),
          totalPrice: totalPrice.toString(),
        },
      });

      customPriceId = customPrice.id;
      subscriptionItems = [{ price: customPrice.id }];
    } else {
      subscriptionItems = [{ price: plan.stripePriceId }];
    }

    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: subscriptionItems,
      trial_period_days:
        plan.trialDays > 0 && !org.hasUsedTrial ? plan.trialDays : undefined,
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        extraAgents: payload.extraAgents?.toString() || "0",
        extraAgentPrice: extraAgentPrice.toString(),
        purchasedNumber: payload.purchasedNumber || "",
        totalMinuteLimit: plan.totalMinuteLimit?.toString() || "0",
        customPriceId: customPriceId || "",
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

    const totalAgents =
      plan.planLevel === "only_ai"
        ? 0
        : plan.defaultAgents + (payload.extraAgents || 0);

    const result = await prisma.$transaction(async (tx) => {
      if (payload.purchasedNumber && payload.sid) {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            purchasedPhoneNumber: payload.purchasedNumber,
            purchasedNumberSid: payload.sid,
          },
        });

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
          totalMinuteLimit: plan.totalMinuteLimit,
          purchasedNumber: payload.purchasedNumber,
          sid: payload.sid,
        },
        include: { plan: true, organization: true },
      });

      // Mark trial as used within the same transaction
      if (plan.trialDays > 0 && !org.hasUsedTrial) {
        await tx.organization.update({
          where: { id: orgId },
          data: { hasUsedTrial: true },
        });
      }

      return subscription;
    });

    return {
      subscription: result,
      clientSecret,
      totalPrice,
      message: `Subscription created. ${
        plan.trialDays > 0 && !org.hasUsedTrial
          ? `${plan.trialDays}-day trial started.`
          : ""
      }${
        payload.extraAgents
          ? ` Added ${payload.extraAgents} extra agents ($${extraAgentPrice}/month).`
          : ""
      }${
        payload.purchasedNumber
          ? ` Purchased phone number: ${payload.purchasedNumber}`
          : ""
      }${
        plan.totalMinuteLimit
          ? ` Monthly minute limit: ${plan.totalMinuteLimit}`
          : ""
      } Total monthly charge: $${totalPrice}`,
    };
  } catch (err: any) {
    console.error("Subscription creation error:", err);

    if (customPriceId) {
      try {
        await stripe.prices.update(customPriceId, { active: false });
      } catch {}
    }

    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } catch {}
    }

    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Subscription creation failed. Please try again."
    );
  }
};

// --------------------------------------------------
//  getOrgSubscriptions
// --------------------------------------------------
const getOrgSubscriptions = async (orgId: string) => {
  return await prisma.subscription.findMany({
    where: { organizationId: orgId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
};

// --------------------------------------------------
//  cancelSubscription
// --------------------------------------------------
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
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to cancel subscription"
    );
  }
};

// --------------------------------------------------
//  resumeSubscription
// --------------------------------------------------
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

// --------------------------------------------------
//  handleWebhook – UPDATED with email integration
// --------------------------------------------------
// --------------------------------------------------

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

  try {
    // === SUBSCRIPTION EVENTS ===
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      const sub = event.data.object as any;
      const updateData: any = {
        status: STATUS_MAP[sub.status] || SubscriptionStatus.INCOMPLETE,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        canceledAt: createSafeDate(sub.canceled_at),
      };
      const start = createSafeDate(sub.current_period_start);
      const end = createSafeDate(sub.current_period_end);
      if (start) updateData.currentPeriodStart = start;
      if (end) updateData.currentPeriodEnd = end;
      const trialStart = createSafeDate(sub.trial_start);
      const trialEnd = createSafeDate(sub.trial_end);
      if (trialStart) updateData.trialStart = trialStart;
      if (trialEnd) updateData.trialEnd = trialEnd;

      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: updateData,
      });
    }

    // === INVOICE EVENTS ===
    if (
      [
        "invoice.created",
        "invoice.paid",
        "invoice.payment_failed",
        "invoice.updated",
      ].includes(event.type)
    ) {
      const inv = event.data.object as any;

      const org = await prisma.organization.findFirst({
        where: { stripeCustomerId: inv.customer },
        select: {
          id: true,
          subscriptions: {
            where: { stripeSubscriptionId: inv.subscription || undefined },
          },
        },
      });

      if (org) {
        const sub = org.subscriptions[0];

        // Convert line item amounts from cents to dollars
        const lineItems = (inv.lines?.data ?? []).map((l: any) => ({
          description: l.description,
          amount: centsToDollars(l.amount), // Convert to dollars
          quantity: l.quantity,
          price_id: l.price?.id,
          product_id: l.price?.product,
          period: {
            start: createSafeDate(l.period?.start)?.toISOString(),
            end: createSafeDate(l.period?.end)?.toISOString(),
          },
        }));

        await prisma.billingInvoice.upsert({
          where: { stripeInvoiceId: inv.id },
          update: {
            status: inv.status,
            amountDue: centsToDollars(inv.amount_due), // Convert to dollars
            amountPaid: centsToDollars(inv.amount_paid), // Convert to dollars
            amountRemaining: centsToDollars(inv.amount_remaining || 0), // Convert to dollars
            subtotal: centsToDollars(inv.subtotal), // Convert to dollars
            total: centsToDollars(inv.total), // Convert to dollars
            periodStart: createSafeDate(inv.period_start),
            periodEnd: createSafeDate(inv.period_end),
            invoiceCreatedAt: createSafeDate(inv.created),
            lineItems,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            invoicePdf: inv.invoice_pdf,
            number: inv.number,
          },
          create: {
            stripeInvoiceId: inv.id,
            organizationId: org.id,
            subscriptionId: sub?.id,
            customerId: inv.customer,
            status: inv.status,
            amountDue: centsToDollars(inv.amount_due), // Convert to dollars
            amountPaid: centsToDollars(inv.amount_paid), // Convert to dollars
            amountRemaining: centsToDollars(inv.amount_remaining || 0), // Convert to dollars
            subtotal: centsToDollars(inv.subtotal), // Convert to dollars
            total: centsToDollars(inv.total), // Convert to dollars
            currency: inv.currency,
            periodStart: createSafeDate(inv.period_start),
            periodEnd: createSafeDate(inv.period_end),
            invoiceCreatedAt: createSafeDate(inv.created),
            lineItems,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            invoicePdf: inv.invoice_pdf,
            number: inv.number,
          },
        });

        // SMART EMAIL HANDLING - Avoid duplicate emails
        switch (event.type) {
          case "invoice.created":
            // Only send invoice email if it's not immediately paid
            // For subscription creation, invoice is often created and paid immediately
            // So we wait for the 'invoice.paid' event instead
            if (inv.status !== "paid") {
              await sendBillingNotification(org.id, inv, "invoice");
            }
            break;

          case "invoice.paid":
            // Always send receipt for paid invoices
            await sendBillingNotification(org.id, inv, "receipt");
            break;

          case "invoice.payment_failed":
            // Always send failure notification
            await sendBillingNotification(org.id, inv, "payment_failed");
            break;
        }
      }
    }

    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type, processed: true },
    });

    return { received: true };
  } catch (error: any) {
    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type, processed: false },
    });
    return { received: true, error: error.message };
  }
};

// --------------------------------------------------
//  getBillingHistory
// --------------------------------------------------
const getBillingHistory = async (
  orgId: string,
  filters?: { limit?: number; status?: string }
) => {
  return await prisma.billingInvoice.findMany({
    where: {
      organizationId: orgId,
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      subscription: { include: { plan: true } },
    },
    orderBy: { invoiceCreatedAt: "desc" },
    take: filters?.limit ?? 20,
  });
};

// ──────────────────────────────────────────────────────────────────────
//  switchPlan
// ──────────────────────────────────────────────────────────────────────

const switchPlan = async (orgId: string, payload: ISwitchPlanRequest) => {
  const { newPlanId, extraAgents } = payload;

  // 1. Find active subscription + validate plan exists
  const activeSub = await prisma.subscription.findFirst({
    where: {
      organizationId: orgId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true, organization: true },
  });

  if (!activeSub || !activeSub.plan) {
    throw new AppError(
      status.NOT_FOUND,
      "Active subscription or plan not found"
    );
  }

  const currentPlan = activeSub.plan;
  const org = activeSub.organization;

  // 2. Load target plan
  const newPlan = await prisma.plan.findUnique({
    where: { id: newPlanId, isActive: true, isDeleted: false },
  });
  if (!newPlan) throw new AppError(status.NOT_FOUND, "Target plan not found");

  // 3. Calculate extra agents
  let requestedAgents = 0;
  let extraAgentPrice = 0;
  let totalAgents = 0;

  if (newPlan.planLevel !== "only_ai") {
    const currentExtra = activeSub.numberOfAgents ?? 0;
    requestedAgents =
      extraAgents !== undefined
        ? extraAgents
        : Math.max(currentExtra - newPlan.defaultAgents, 0);

    if (requestedAgents < 0) {
      throw new AppError(
        status.BAD_REQUEST,
        "Cannot reduce below default agents of the new plan"
      );
    }

    if (requestedAgents > 0) {
      const pricing = newPlan.extraAgentPricing as any[];
      const tier = pricing?.find((p: any) => p.agents === requestedAgents);
      if (!tier) {
        throw new AppError(
          status.BAD_REQUEST,
          `Extra agent tier for ${requestedAgents} agents not configured`
        );
      }
      extraAgentPrice = tier.price;
    }

    totalAgents = newPlan.defaultAgents + requestedAgents;
  }

  const totalPrice = newPlan.price + extraAgentPrice;

  // 4. Create custom price if extra agents
  let newPriceId = newPlan.stripePriceId;
  let customPriceId: string | null = null;

  if (extraAgentPrice > 0) {
    const customPrice = await stripe.prices.create({
      unit_amount: Math.round(totalPrice * 100),
      currency: "usd",
      recurring: {
        interval: newPlan.interval.toLowerCase() as "month" | "year",
      },
      product: newPlan.stripeProductId,
      metadata: {
        planId: newPlan.id,
        basePrice: newPlan.price.toString(),
        extraAgents: requestedAgents.toString(),
        extraAgentPrice: extraAgentPrice.toString(),
        totalPrice: totalPrice.toString(),
      },
    });
    newPriceId = customPrice.id;
    customPriceId = customPrice.id;
  }

  // 5. Update Stripe subscription
  const prorationBehavior = "create_prorations";

  const stripeSub = await stripe.subscriptions.retrieve(
    activeSub.stripeSubscriptionId
  );
  const currentItem = stripeSub.items.data[0];

  await stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
    proration_behavior: prorationBehavior,
    items: [
      {
        id: currentItem.id,
        price: newPriceId,
      },
    ],
    metadata: {
      ...stripeSub.metadata,
      extraAgents: requestedAgents.toString(),
      totalMinuteLimit: newPlan.totalMinuteLimit?.toString() ?? "0",
      customPriceId: customPriceId ?? "",
    },
  });

  // 6. Check proration amount
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    subscription: activeSub.stripeSubscriptionId,
  });

  const prorationAmountDueCents = upcomingInvoice.amount_due;
  const prorationAmountDue = prorationAmountDueCents / 100;

  // 7. CHARGE IMMEDIATELY IF UPGRADE
  if (prorationAmountDue > 0) {
    try {
      const invoice = await stripe.invoices.create({
        customer: upcomingInvoice.customer as string,
        subscription: activeSub.stripeSubscriptionId,
        auto_advance: true,
        description: `Plan switch proration: ${currentPlan.name} to ${newPlan.name}`,
      });

      const paidInvoice = await stripe.invoices.pay(invoice.id);
      console.log(
        `Immediate proration charge: $${prorationAmountDue} (Invoice: ${paidInvoice.id})`
      );
    } catch (err: any) {
      console.error("Failed to charge proration immediately:", err.message);
      throw new AppError(
        status.PAYMENT_REQUIRED,
        `Upgrade requires immediate payment of $${prorationAmountDue}. Card declined or insufficient funds.`
      );
    }
  } else if (prorationAmountDue < 0) {
    console.log(
      `Proration credit: $${Math.abs(
        prorationAmountDue
      )} (applied to next invoice)`
    );
  } else {
    console.log("No proration (same price or exact timing)");
  }

  // 8. Update DB
  const updatedSub = await prisma.subscription.update({
    where: { id: activeSub.id },
    data: {
      planId: newPlan.id,
      planLevel: newPlan.planLevel,
      numberOfAgents: totalAgents,
      totalMinuteLimit: newPlan.totalMinuteLimit,
    },
    include: { plan: true },
  });

  // 9. Return
  return {
    subscription: updatedSub,
    prorated: prorationAmountDue !== 0,
    immediateCharge: prorationAmountDue > 0 ? prorationAmountDue : 0,
    totalPrice,
    message: `Switched to "${newPlan.name}"${
      requestedAgents > 0 ? ` ${requestedAgents} extra agent(s) applied.` : ""
    }${
      prorationAmountDue > 0
        ? ` Charged $${prorationAmountDue} immediately for upgrade.`
        : prorationAmountDue < 0
        ? ` Credit of $${Math.abs(prorationAmountDue)} applied to next invoice.`
        : ""
    }`,
  };
};

export const SubscriptionService = {
  createSubscription,
  getOrgSubscriptions,
  cancelSubscription,
  resumeSubscription,
  handleWebhook,
  getBillingHistory,
  switchPlan,
};
