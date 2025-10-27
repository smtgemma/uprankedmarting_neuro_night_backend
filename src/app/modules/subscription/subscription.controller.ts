import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { SubscriptionServices } from "./subscription.service";

const createSubscription = catchAsync(async (req, res) => {
  const { 
    planId, 
    organizationId, 
    planLevel, 
    purchasedNumber, 
    sid, 
    numberOfAgents,
    paymentMethodId // NEW FIELD
  } = req.body;

  // Validate required fields
  if (!planId || !organizationId || !planLevel || !purchasedNumber || !sid || !paymentMethodId) {
    return sendResponse(res, {
      statusCode: status.BAD_REQUEST,
      message: "Missing required fields: planId, organizationId, planLevel, purchasedNumber, sid, paymentMethodId are required",
      data: null,
    });
  }

  // Normalize phone number
  let normalizedPhone = purchasedNumber.trim();
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = `+${normalizedPhone}`;
  }

  const result = await SubscriptionServices.createSubscription(
    organizationId,
    planId,
    planLevel,
    normalizedPhone,
    sid,
    numberOfAgents || 0,
    paymentMethodId // Pass payment method
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    message: `Subscription created successfully. Trial period started. You will be charged $${result.subscription.amount} on ${new Date(result.trialEndDate).toLocaleDateString()}.`,
    data: result,
  });
});

const getAllSubscription = catchAsync(async (req, res) => {
  const results = await SubscriptionServices.getAllSubscription(req.query);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscriptions retrieved successfully",
    meta: results.meta,
    data: results.data,
  });
});

const getSingleSubscription = catchAsync(async (req, res) => {
  const result = await SubscriptionServices.getSingleSubscription(
    req.params.subscriptionId
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription retrieved successfully",
    data: result,
  });
});

const getMySubscription = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const result = await SubscriptionServices.getMySubscription(userId);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription retrieved successfully.",
    data: result,
  });
});

const updateSubscription = catchAsync(async (req, res) => {
  const { subscriptionId } = req.params;

  const result = await SubscriptionServices.updateSubscription(
    subscriptionId,
    req.body
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription updated successfully.",
    data: result,
  });
});

const deleteSubscription = catchAsync(async (req, res) => {
  const result = await SubscriptionServices.deleteSubscription(
    req.params.subscriptionId
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription deleted successfully.",
    data: result,
  });
});

const changePlan = catchAsync(async (req, res) => {
  const { subscriptionId } = req.params;
  const { newPlanId, numberOfAgents } = req.body;

  // Validate required fields
  if (!newPlanId) {
    return sendResponse(res, {
      statusCode: status.BAD_REQUEST,
      message: "newPlanId is required",
      data: null,
    });
  }

  const result = await SubscriptionServices.changePlan(
    subscriptionId,
    newPlanId,
    numberOfAgents
  );

  sendResponse(res, {
    statusCode: status.OK,
    message:
      "Plan changed successfully. Prorated amount will be charged/credited.",
    data: result,
  });
});

const updateAgentCount = catchAsync(async (req, res) => {
  const { subscriptionId } = req.params;
  const { numberOfAgents } = req.body;

  // Validate required fields
  if (!numberOfAgents || numberOfAgents < 1) {
    return sendResponse(res, {
      statusCode: status.BAD_REQUEST,
      message: "numberOfAgents is required and must be at least 1",
      data: null,
    });
  }

  const result = await SubscriptionServices.updateAgentCount(
    subscriptionId,
    numberOfAgents
  );

  sendResponse(res, {
    statusCode: status.OK,
    message:
      "Agent count updated successfully. Prorated amount will be charged/credited.",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req, res) => {
  const { subscriptionId } = req.params;

  const result = await SubscriptionServices.cancelSubscription(subscriptionId);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription canceled successfully.",
    data: result,
  });
});

const handleStripeWebhook = catchAsync(async (req, res) => {
  try {
    const result = await SubscriptionServices.HandleStripeWebhook(req.body);

    sendResponse(res, {
      statusCode: status.OK,
      message: "Webhook event triggered successfully",
      data: result,
    });
  } catch (error) {
    // Still return success to Stripe to avoid retries, but log the error
    sendResponse(res, {
      statusCode: status.OK,
      message: "Webhook received but processing failed",
      data: { received: true, error: error },
    });
  }
});

export const SubscriptionController = {
  createSubscription,
  getAllSubscription,
  getMySubscription,
  handleStripeWebhook,
  getSingleSubscription,
  updateSubscription,
  deleteSubscription,
  changePlan,
  updateAgentCount,
  cancelSubscription,
};
