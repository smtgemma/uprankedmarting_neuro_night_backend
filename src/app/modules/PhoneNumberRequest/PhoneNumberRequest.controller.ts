// ============ 4. CONTROLLER LAYER ============
// phoneNumberRequest.controller.ts

import { Request, Response } from "express";
import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { User } from "@prisma/client";
import { PhoneNumberRequestService } from "./PhoneNumberRequest.service";

const submitPhoneNumberRequest = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PhoneNumberRequestService.submitPhoneNumberRequestToDB(
      req.body,
      req.user as User
    );

    sendResponse(res, {
      statusCode: status.CREATED,
      message: "Phone number request submitted successfully!",
      data: result,
    });
  }
);

const getAllPhoneNumberRequests = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PhoneNumberRequestService.getAllPhoneNumberRequestsFromDB(
      req.query
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Phone number requests retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }
);

const getSinglePhoneNumberRequest = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await PhoneNumberRequestService.getSinglePhoneNumberRequestFromDB(
      id
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Phone number request retrieved successfully",
      data: result,
    });
  }
);

const approvePhoneNumberRequest = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assignedNumberId } = req.body;
    const result = await PhoneNumberRequestService.approvePhoneNumberRequestInDB(
      id,
      assignedNumberId
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Phone number request approved successfully",
      data: result,
    });
  }
);

const rejectPhoneNumberRequest = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const result = await PhoneNumberRequestService.rejectPhoneNumberRequestInDB(
      id,
      rejectionReason
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Phone number request rejected successfully",
      data: result,
    });
  }
);

export const PhoneNumberRequestController = {
  submitPhoneNumberRequest,
  getAllPhoneNumberRequests,
  getSinglePhoneNumberRequest,
  approvePhoneNumberRequest,
  rejectPhoneNumberRequest,
};