// import {
//   handlePaymentIntentFailed,
//   handlePaymentIntentSucceeded,
// } from "../../utils/webhook";
// import Stripe from "stripe";
// import status from "http-status";
// import prisma from "../../utils/prisma";
// import { stripe } from "../../utils/stripe";
// import AppError from "../../errors/AppError";
// import { Subscription } from "@prisma/client";
// import QueryBuilder from "../../builder/QueryBuilder";

import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import { stripe } from "../../utils/stripe";
import QueryBuilder from "../../builder/QueryBuilder";
import Stripe from "stripe";
import {
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
} from "../../utils/webhook";
import { PlanLevel, Subscription } from "@prisma/client";

// const createSubscription = async (
//   organizationId: string,
//   planId: string,
//   planLevel: PlanLevel,
//   purchasedNumber: string,
//   sid: string,
//   numberOfAgents: number
// ) => {
//   return await prisma.$transaction(async (tx) => {
//     // 1. Verify organization exists
//     const organization = await tx.organization.findUnique({
//       where: { id: organizationId },
//     });

//     if (!organization) {
//       throw new AppError(status.NOT_FOUND, "Organization not found");
//     }

//     // 2. Verify plan exists with all needed fields
//     const plan = await tx.plan.findUnique({
//       where: { id: planId },
//     });
//     if (!plan) {
//       throw new AppError(status.NOT_FOUND, "Plan not found");
//     }

//     // 3. Calculate end date based on plan interval
//     const startDate = new Date();
//     let endDate: Date | null = null;

//     if (plan.interval === "month") {
//       endDate = new Date(startDate);
//       endDate.setMonth(endDate.getMonth() + (plan.intervalCount || 1));
//       // Handle month overflow (e.g., Jan 31 + 1 month)
//       if (endDate.getDate() !== startDate.getDate()) {
//         endDate.setDate(0); // Set to last day of previous month
//       }
//     } else if (plan.interval === "year") {
//       endDate = new Date(startDate);
//       endDate.setFullYear(endDate.getFullYear() + (plan.intervalCount || 1));
//     } else if (plan.interval === "week") {
//       endDate = new Date(startDate);
//       endDate.setDate(endDate.getDate() + (plan.intervalCount || 1) * 7);
//     } else if (plan.interval === "day") {
//       endDate = new Date(startDate);
//       endDate.setDate(endDate.getDate() + (plan.intervalCount || 1));
//     }

//     // 4. Create payment intent in Stripe
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(plan.amount * 100),
//       currency: "usd",
//       metadata: {
//         organizationId: organization.id,
//         planId,
//       },
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     // 5. Handle existing subscription
//     const existingSubscription = await tx.subscription.findFirst({
//       where: { organizationId: organization.id, paymentStatus: "PENDING" },
//     });

//     let subscription;
//     if (existingSubscription) {
//       subscription = await tx.subscription.update({
//         where: { id: existingSubscription.id },
//         data: {
//           planId,
//           stripePaymentId: paymentIntent.id,
//           startDate,
//           amount: plan.amount,
//           endDate: existingSubscription.endDate || endDate,
//           paymentStatus: "PENDING",
//         },
//       });
//     } else {
//       // 6. Create new subscription with calculated endDate
//       subscription = await tx.subscription.create({
//         data: {
//           organizationId: organization.id,
//           planId,
//           startDate,
//           amount: plan.amount,
//           stripePaymentId: paymentIntent.id,
//           paymentStatus: "PENDING",
//           endDate,
//           planLevel,
//           purchasedNumber,
//           sid, // Now includes the calculated endDate
//         },
//       });
//     }

//     return {
//       subscription,
//       clientSecret: paymentIntent.client_secret,
//       paymentIntentId: paymentIntent.id,
//     };
//   });
// };

const createSubscription = async (
  organizationId: string,
  planId: string,
  planLevel: PlanLevel,
  purchasedNumber: string,
  sid: string,
  numberOfAgents: number
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify organization exists
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    // 2. Verify plan exists
    const plan = await tx.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new AppError(status.NOT_FOUND, "Plan not found");
    }

    // 3. Normalize phone number format
    let normalizedPurchasedNumber = purchasedNumber;
    if (!normalizedPurchasedNumber.startsWith("+")) {
      normalizedPurchasedNumber = `+${normalizedPurchasedNumber}`;
    }

    // 4. Verify the phone number exists in AvailableTwilioNumber
    const availableNumber = await tx.availableTwilioNumber.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPurchasedNumber },
          { phoneNumber: normalizedPurchasedNumber.replace("+", "") },
        ],
      },
    });

    if (!availableNumber) {
      throw new AppError(
        status.NOT_FOUND,
        `Phone number ${purchasedNumber} is not available`
      );
    }

    if (availableNumber.isPurchased) {
      throw new AppError(
        status.BAD_REQUEST,
        `Phone number ${purchasedNumber} is already purchased`
      );
    }

    // Use the exact format from the database
    const dbPhoneNumber = availableNumber.phoneNumber;

    // 5. Calculate end date based on plan interval
    const startDate = new Date();
    let endDate: Date | null = null;

    if (plan.interval === "month") {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + (plan.intervalCount || 1));
      if (endDate.getDate() !== startDate.getDate()) {
        endDate.setDate(0);
      }
    } else if (plan.interval === "year") {
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + (plan.intervalCount || 1));
    } else if (plan.interval === "week") {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (plan.intervalCount || 1) * 7);
    } else if (plan.interval === "day") {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (plan.intervalCount || 1));
    }

    // 6. Calculate final amount (base + $20 per agent)
    const finalAmount =
      plan.amount + (numberOfAgents > 0 ? numberOfAgents * 20 : 0);

    // 7. Create payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100), // convert to cents
      currency: "usd",
      metadata: {
        organizationId: organization.id,
        planId,
        numberOfAgents: numberOfAgents?.toString(),
        purchasedNumber: dbPhoneNumber, // Store in metadata as well
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // 8. Handle existing subscription
    const existingSubscription = await tx.subscription.findFirst({
      where: { organizationId: organization.id, paymentStatus: "PENDING" },
    });

    let subscription;
    if (existingSubscription) {
      subscription = await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId,
          stripePaymentId: paymentIntent.id,
          startDate,
          amount: finalAmount,
          endDate: existingSubscription.endDate || endDate,
          paymentStatus: "PENDING",
          numberOfAgents,
          purchasedNumber: dbPhoneNumber, // Use the format from database
          sid,
          planLevel,
        },
      });
    } else {
      // 9. Create new subscription
      subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId,
          startDate,
          amount: finalAmount,
          stripePaymentId: paymentIntent.id,
          paymentStatus: "PENDING",
          endDate,
          planLevel,
          purchasedNumber: dbPhoneNumber, // Use the format from database
          sid,
          numberOfAgents,
        },
      });
    }

    console.log(
      "Created subscription with phone number:",
      normalizedPurchasedNumber
    );

    return {
      subscription,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
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
              amount: true,
              paymentStatus: true,
              status: true,
              planLevel: true,
               purchasedNumber: true,
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
    include: {
      ownedOrganization: true,
    },
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
              amount: true,
              paymentStatus: true,
              status: true,
              planLevel: true,
              purchasedNumber: true,
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
  data: Subscription
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
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new AppError(status.NOT_FOUND, "Subscription not found");
  }

  // Cancel the subscription in Stripe if it exists
  if (subscription.stripePaymentId) {
    try {
      await stripe.paymentIntents.cancel(subscription.stripePaymentId);
    } catch (error) {
      console.error("Error canceling Stripe payment:", error);
    }
  }

  const result = await prisma.subscription.delete({
    where: { id: subscriptionId },
  });

  return result;
};

const HandleStripeWebhook = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Webhook handling failed");
  }
};

export const SubscriptionServices = {
  getMySubscription,
  createSubscription,
  getAllSubscription,
  updateSubscription,
  deleteSubscription,
  HandleStripeWebhook,
  getSingleSubscription,
};
