import {
  Interval,
  PaymentStatus,
  PlanLevel,
  SubscriptionStatus,
} from "@prisma/client";
import AppError from "../errors/AppError";
import status from "http-status";
import Stripe from "stripe";
import prisma from "./prisma";
import axios from "axios";
import config from "../config";

// Helper function to calculate end date based on plan interval
const calculateEndDate = (
  startDate: Date,
  interval: Interval,
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
      // Handle month overflow (e.g., Jan 31 + 1 month)
      if (endDate.getDate() !== startDate.getDate()) {
        endDate.setDate(0); // Set to last day of previous month
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

// Legacy handler for direct payment intents (kept for backward compatibility)
const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  console.log("Processing payment intent:", paymentIntent.id);

  // Find payment in database with plan details
  const payment = await prisma.subscription.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    include: {
      plan: true,
      organization: true,
    },
  });

  if (!payment) {
    console.log(
      `Payment not found for ID: ${paymentIntent.id} - This might be handled by subscription webhook`
    );
    return; // Don't throw error, might be handled by subscription webhook
  }

  console.log("Found payment:", {
    id: payment.id,
    organizationId: payment.organizationId,
    purchasedNumber: payment.purchasedNumber,
    planLevel: payment.planLevel,
  });

  if (!payment.plan) {
    throw new AppError(
      status.NOT_FOUND,
      "Plan not found for this subscription"
    );
  }

  if (paymentIntent.status !== "succeeded") {
    throw new AppError(
      status.BAD_REQUEST,
      "Payment intent is not in succeeded state"
    );
  }

  const startDate = new Date();
  const endDate = calculateEndDate(
    startDate,
    payment.plan.interval,
    payment.plan.intervalCount
  );

  // Ensure purchasedNumber has correct format
  let phoneNumber = payment.purchasedNumber;
  if (!phoneNumber.startsWith("+")) {
    phoneNumber = `+${phoneNumber}`;
  }

  console.log("Phone number to update:", phoneNumber);

  // Check if AvailableTwilioNumber exists
  const twilioNumber = await prisma.availableTwilioNumber.findUnique({
    where: { phoneNumber: phoneNumber },
  });

  if (!twilioNumber) {
    console.error(`AvailableTwilioNumber not found for: ${phoneNumber}`);
    throw new AppError(
      status.NOT_FOUND,
      `Twilio number not found: ${phoneNumber}`
    );
  }

  console.log("Found Twilio number:", twilioNumber.phoneNumber);

  // Update subscription, organization, and availableTwilioNumber in a transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id: payment.id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
        },
      });
      console.log("Updated subscription:", updatedSubscription.id);

      // Update organizationNumber in Organization
      const updatedOrganization = await tx.organization.update({
        where: { id: payment.organizationId },
        data: {
          organizationNumber: phoneNumber,
        },
      });
      console.log("Updated organization:", {
        id: updatedOrganization.id,
        organizationNumber: updatedOrganization.organizationNumber,
      });

      // Update AvailableTwilioNumber
      const updatedTwilioNumber = await tx.availableTwilioNumber.update({
        where: { phoneNumber: phoneNumber },
        data: {
          isPurchased: true,
          purchasedByOrgId: payment.organizationId,
          purchasedAt: new Date(),
        },
      });
      console.log("Updated Twilio number:", updatedTwilioNumber.phoneNumber);

      return {
        subscription: updatedSubscription,
        organization: updatedOrganization,
        twilioNumber: updatedTwilioNumber,
      };
    });

    console.log("Transaction completed successfully");

    // Send POST request to Twilio auto-route endpoint
    if (payment.planLevel === PlanLevel.only_real_agent) {
      try {
        const payload = {
          payment_status: PaymentStatus.COMPLETED,
          phone: phoneNumber,
          sid: payment.sid,
          plan: payment.planLevel,
          organization_id: payment.organizationId,
        };

        console.log("Sending payload to Twilio:", payload);

        await axios.post(config.twilio.twilio_auto_route_url!, payload, {
          headers: {
            "Content-Type": "application/json",
          },
        });
        console.log(
          "Successfully sent POST request to Twilio auto-route endpoint"
        );
      } catch (error) {
        console.error("Error sending POST request to Twilio:", error);
      }
    }

    return result;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
};

const handlePaymentIntentFailed = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  console.log("Processing failed payment intent:", paymentIntent.id);

  // Find payment in the database
  const payment = await prisma.subscription.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (!payment) {
    console.log(`Payment not found for ID: ${paymentIntent.id}`);
    return; // Don't throw error
  }

  // Update payment status to failed
  await prisma.subscription.update({
    where: { id: payment.id },
    data: {
      paymentStatus: PaymentStatus.CANCELED,
      status: SubscriptionStatus.CANCELED,
      endDate: new Date(),
    },
  });

  console.log(
    `Subscription ${payment.id} marked as canceled due to payment failure`
  );
};

// New handlers for subscription-based webhooks
const handleSubscriptionTrialWillEnd = async (
  subscription: Stripe.Subscription
) => {
  console.log("Trial ending soon for subscription:", subscription.id);

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      organization: {
        include: {
          ownedOrganization: true,
        },
      },
    },
  });

  if (dbSubscription && dbSubscription.organization?.ownedOrganization) {
    // TODO: Send email reminder
    console.log(
      `Sending trial ending reminder to: ${dbSubscription.organization.ownedOrganization.email}`
    );
  }
};

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  console.log("Subscription updated:", subscription.id);

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (dbSubscription) {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status as SubscriptionStatus,
      },
    });
    console.log(`Updated subscription status to: ${subscription.status}`);
  }
};

const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  console.log("Invoice payment succeeded:", invoice.id);

  // Get subscription ID from invoice lines (this is the correct way)
  const subscriptionId = invoice.lines?.data?.[0]?.subscription;

  if (!subscriptionId || typeof subscriptionId !== "string") {
    console.log("No valid subscription ID found in invoice");
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.log(`Subscription not found for Stripe ID: ${subscriptionId}`);
    return;
  }

  const isFirstPayment = subscription.status === SubscriptionStatus.TRIALING;
  console.log(`Is first payment after trial: ${isFirstPayment}`);

  await prisma.$transaction(async (tx) => {
    // Update subscription to active
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        startDate: isFirstPayment ? new Date() : subscription.startDate,
        endDate: calculateEndDate(
          new Date(),
          subscription.plan!.interval,
          subscription.plan!.intervalCount
        ),
      },
    });
    console.log("Updated subscription to ACTIVE");

    // If first payment after trial, finalize phone number purchase
    if (isFirstPayment) {
      let phoneNumber = subscription.purchasedNumber;
      if (!phoneNumber.startsWith("+")) {
        phoneNumber = `+${phoneNumber}`;
      }

      await tx.availableTwilioNumber.update({
        where: { phoneNumber: phoneNumber },
        data: {
          isPurchased: true,
          purchasedByOrgId: subscription.organizationId,
          purchasedAt: new Date(),
          requestedByOrgId: null,
        },
      });
      console.log("Finalized phone number purchase:", phoneNumber);

      // Update organization number
      await tx.organization.update({
        where: { id: subscription.organizationId },
        data: {
          organizationNumber: phoneNumber,
        },
      });

      // Call Twilio auto-route if needed
      if (subscription.planLevel === PlanLevel.only_real_agent) {
        try {
          const payload = {
            payment_status: PaymentStatus.COMPLETED,
            phone: phoneNumber,
            sid: subscription.sid,
            plan: subscription.planLevel,
            organization_id: subscription.organizationId,
          };

          console.log("Sending payload to Twilio:", payload);

          await axios.post(config.twilio.twilio_auto_route_url!, payload, {
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log(
            "Successfully sent POST request to Twilio auto-route endpoint"
          );
        } catch (error) {
          console.error("Error sending POST request to Twilio:", error);
        }
      }
    }
  });
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  console.log("Invoice payment failed:", invoice.id);

  // Get subscription ID from invoice lines
  const subscriptionId = invoice.lines?.data?.[0]?.subscription;

  if (!subscriptionId || typeof subscriptionId !== "string") {
    console.log("No valid subscription ID found in invoice");
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      organization: {
        include: {
          ownedOrganization: true,
        },
      },
    },
  });

  if (!subscription) {
    console.log(`Subscription not found for Stripe ID: ${subscriptionId}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  console.log(`Subscription ${subscription.id} marked as PAST_DUE`);

  // TODO: Send payment failed email
  if (subscription.organization?.ownedOrganization) {
    console.log(
      `Send payment failed email to: ${subscription.organization.ownedOrganization.email}`
    );
  }
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  console.log("Subscription deleted/canceled:", subscription.id);

  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (dbSubscription) {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        endDate: new Date(),
      },
    });
    console.log(`Subscription ${dbSubscription.id} marked as CANCELED`);

    // If subscription was in trial, release the phone number
    if (dbSubscription.status === SubscriptionStatus.TRIALING) {
      let phoneNumber = dbSubscription.purchasedNumber;
      if (!phoneNumber.startsWith("+")) {
        phoneNumber = `+${phoneNumber}`;
      }

      await prisma.availableTwilioNumber.update({
        where: { phoneNumber: phoneNumber },
        data: {
          requestedByOrgId: null,
        },
      });
      console.log("Released phone number from trial subscription");
    }
  }
};

export {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleSubscriptionTrialWillEnd,
  handleSubscriptionUpdated,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
};
