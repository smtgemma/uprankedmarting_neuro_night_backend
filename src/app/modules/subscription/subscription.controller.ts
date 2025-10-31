// modules/subscription/subscription.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { SubscriptionService } from "./subscription.service";
import sendResponse from "../../utils/sendResponse";
import status from "http-status";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const result = await SubscriptionService.createSubscription(orgId!, req.body);
  sendResponse(res, {
    statusCode: status.CREATED,
    message: result.message,
    data: result,
  });
});

const getOrgSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const result = await SubscriptionService.getOrgSubscriptions(orgId!);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscriptions retrieved",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const result = await SubscriptionService.cancelSubscription(orgId!, req.body);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Canceled",
    data: result,
  });
});

const resumeSubscription = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const result = await SubscriptionService.resumeSubscription(
    orgId!,
    req.params.id
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Resumed",
    data: result,
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.handleWebhook(
    (req as any).rawBody,
    req.headers["stripe-signature"] as string
  );
  res.status(200).json(result);
});

const getBillingHistory = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId!;
  const { limit, status: statusFilter } = req.query;

  const result = await SubscriptionService.getBillingHistory(orgId, {
    limit: limit ? Number(limit) : undefined,
    status: statusFilter as string | undefined,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: "Billing history retrieved successfully",
    data: result,
  });
});

export const SubscriptionController = {
  createSubscription,
  getOrgSubscriptions,
  cancelSubscription,
  resumeSubscription,
  handleWebhook,
  getBillingHistory,
};
