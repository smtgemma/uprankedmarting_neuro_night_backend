import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { SubscriptionServices } from "./subscription.service";

const createSubscription = catchAsync(async (req, res) => {
  const { planId, organizationId, planLevel, purchasedNumber, sid, numberOfAgents } = req.body;

  // Enhanced logging for debugging
  console.log("Creating subscription with data:", {
    planId,
    organizationId,
    planLevel,
    purchasedNumber,
    sid,
    numberOfAgents,
  });

  // Validate required fields
  if (!planId || !organizationId || !planLevel || !purchasedNumber || !sid) {
    return sendResponse(res, {
      statusCode: status.BAD_REQUEST,
      message: "Missing required fields: planId, organizationId, planLevel, purchasedNumber, sid are required",
      data: null,
    });
  }

  // Validate phone number format
  let normalizedPhone = purchasedNumber.trim();
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = `+${normalizedPhone}`;
  }

  console.log("Normalized phone number:", normalizedPhone);

  const result = await SubscriptionServices.createSubscription(
    organizationId,
    planId,
    planLevel,
    normalizedPhone, // Use normalized phone number
    sid,
    numberOfAgents || 0
  );

  console.log("Subscription created successfully:", result.subscription.id);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Subscription created successfully.",
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

const handleStripeWebhook = catchAsync(async (req, res) => {
  console.log("Webhook received:", req.body.type);
  
  try {
    const result = await SubscriptionServices.HandleStripeWebhook(req.body);
    
    console.log("Webhook processed successfully");
    
    sendResponse(res, {
      statusCode: status.OK,
      message: "Webhook event triggered successfully",
      data: result,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    
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
};