import { Interval, PaymentStatus, SubscriptionStatus } from "@prisma/client";
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

const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  console.log("Processing payment intent:", paymentIntent.id);

  // Find payment in database with plan details
  const payment = await prisma.subscription.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    include: {
      plan: true,
      organization: true, // Include organization to debug
    },
  });

  if (!payment) {
    throw new AppError(
      status.NOT_FOUND,
      `Payment not found for ID: ${paymentIntent.id}`
    );
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

  // Ensure purchasedNumber has correct format (since DB stores with +)
  let phoneNumber = payment.purchasedNumber;
  if (!phoneNumber.startsWith("+")) {
    phoneNumber = `+${phoneNumber}`;
  }

  console.log("Phone number to update:", phoneNumber);
  console.log(
    "Original purchasedNumber from payment:",
    payment.purchasedNumber
  );

  // Check if AvailableTwilioNumber exists before updating
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

    // Send POST request to Twilio auto-route endpoint only if planLevel is 'only_real_agent'
    if (payment.planLevel === "only_real_agent") {
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
        // Optionally, handle the error (e.g., log to a monitoring service, retry, or throw)
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
