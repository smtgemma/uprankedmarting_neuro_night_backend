// import { PrismaClient, SubscriptionStatus } from "@prisma/client";
// import { CronJob } from "node-cron";
// import config from "../config";

import { PaymentStatus, SubscriptionStatus } from "@prisma/client";
import prisma from "../../utils/prisma";
import axios from "axios";
import config from "../../config";
import AppError from "../../errors/AppError";
import status from "http-status";
import { schedule } from "node-cron";

const handleExpiredSubscriptions = async () => {
  try {
    console.log("Checking for expired subscriptions...");

    // Find subscriptions that are active but past their endDate
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.INCOMPLETE,
            SubscriptionStatus.UNPAID,
          ],
        },
        endDate: {
          lte: new Date(), // Expired subscriptions
        },
      },
      include: {
        organization: true,
      },
    });

    if (expiredSubscriptions.length === 0) {
      console.log("No expired subscriptions found.");
      return;
    }

    // Process each expired subscription in a transaction
    for (const subscription of expiredSubscriptions) {
      await prisma.$transaction(async (tx) => {
        // Update subscription status to CANCELED
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.CANCELED,
            paymentStatus: PaymentStatus.CANCELED,
          },
        });

        // Release the Twilio number
        if (subscription.purchasedNumber) {
          await tx.availableTwilioNumber.updateMany({
            where: { phoneNumber: subscription.purchasedNumber },
            data: {
              isPurchased: false,
              purchasedByOrganizationId: null,
              purchasedAt: null,
            },
          });
        }

        // Clear organizationNumber from Organization
        await tx.organization.update({
          where: { id: subscription.organizationId },
          data: {
            organizationNumber: null,
          },
        });

        console.log(`Subscription ${subscription.id} marked as CANCELED and resources released.`);
      });

      // Notify Twilio if planLevel is 'only_real_agent'
      if (subscription.planLevel === "only_real_agent" && subscription.purchasedNumber) {
        try {
          await axios.post(
            config.twilio.twilio_auto_route_url!,
            {
              payment_status: PaymentStatus.CANCELED,
              phone: subscription.purchasedNumber,
              sid: subscription.sid,
              plan: subscription.planLevel,
              organization_id: subscription.organizationId,
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );
          console.log(`Notified Twilio for subscription ${subscription.id} cancellation.`);
        } catch (error) {
          console.error(`Failed to notify Twilio for subscription ${subscription.id}:`, error);
        }
      }
    }

    console.log(`Processed ${expiredSubscriptions.length} expired subscriptions.`);
  } catch (error) {
    console.error("Error processing expired subscriptions:", error);
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to process expired subscriptions");
  }
};

// Schedule the job to run daily at midnight (Asia/Dhaka)
let expirationJob: any;

const scheduleExpirationJob = () => {
  expirationJob = schedule(
    "0 0 * * *", // Every day at midnight
    handleExpiredSubscriptions,
    {
      timezone: "Asia/Dhaka",
    }
  );
  console.log("Subscription expiration job scheduled.");
};

export { handleExpiredSubscriptions, scheduleExpirationJob, expirationJob };