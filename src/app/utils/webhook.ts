import Stripe from "stripe";
import status from "http-status";
import { PaymentStatus, Interval, SubscriptionStatus } from "@prisma/client";
import AppError from "../errors/AppError";
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

const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  // Find payment in database with plan details
  const payment = await prisma.subscription.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    include: {
      plan: true,
    },
  });

  if (!payment) {
    throw new AppError(
      status.NOT_FOUND,
      `Payment not found for ID: ${paymentIntent.id}`
    );
  }

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

// Update subscription, organization, and availableTwilioNumber in a transaction
  await prisma.$transaction([
    // Update subscription
    prisma.subscription.update({
      where: { id: payment.id },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
    }),
    // Update organizationNumber in Organization
    // console.log("Payment Number:", payment.purchasedNumber),  
    prisma.organization.update({
      where: { id: payment.organizationId },
      data: {
        organizationNumber: payment.purchasedNumber,
      },
    }),
    // Update AvailableTwilioNumber
    prisma.availableTwilioNumber.update({
      where: { phoneNumber: payment.purchasedNumber },
      data: {
        isPurchased: true,
        purchasedByOrganizationId: payment.organizationId,
        purchasedAt: new Date(),
      },
    }),
  ]);

  // Send POST request to Twilio auto-route endpoint only if planLevel is 'only_real_agent'
  if (payment.planLevel === "only_real_agent") {
    try {
      const payload = {
        payment_status: PaymentStatus.COMPLETED,
        phone: payment.purchasedNumber,
        sid: payment.sid,
        plan: payment.planLevel,
        organization_id: payment.organizationId,
      };

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
      // Optionally, handle the error (e.g., log to a monitoring service, retry, or throw)
    }
  }
};

const handlePaymentIntentFailed = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  // Find payment in the database
  const payment = await prisma.subscription.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (!payment) {
    throw new AppError(
      status.NOT_FOUND,
      `Payment not found for ID: ${paymentIntent.id}`
    );
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
};

export { handlePaymentIntentSucceeded, handlePaymentIntentFailed };
