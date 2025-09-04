import status from "http-status";
import { ServiceFeedbackServices } from "./serviceFeedback.service";
import catchAsync from "../../../utils/catchAsync";
import sendResponse from "../../../utils/sendResponse";
import { User } from "@prisma/client";

const createServiceFeedback = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await ServiceFeedbackServices.createServiceFeedback(
    req.body,
    userId
  );
  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Service feedback created successfully!",
    data: result,
  });
});

const getAllServiceFeedbacks = catchAsync(async (req, res) => {
  // console.log("___________ hitted")

  const result = await ServiceFeedbackServices.getAllServiceFeedbacks(
    req.query
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedbacks fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleServiceFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ServiceFeedbackServices.getSingleServiceFeedback(id);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedback fetched successfully!",
    data: result,
  });
});

const updateServiceFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ServiceFeedbackServices.updateServiceFeedback(
    id,
    req.body,
    req.user.id as string
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedback updated successfully!",
    data: result,
  });
});

const deleteServiceFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ServiceFeedbackServices.deleteServiceFeedback(
    id,
    req.user as User
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedback deleted successfully!",
    data: result,
  });
});

const getServiceFeedbacksByClient = catchAsync(async (req, res) => {
  const result = await ServiceFeedbackServices.getServiceFeedbacksByClient(
    req.query,
    req.user.id as string
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedbacks by client fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getServiceFeedbacksByRating = catchAsync(async (req, res) => {
  const { rating } = req.params;
  const result = await ServiceFeedbackServices.getServiceFeedbacksByRating(
    Number(rating),
    req.query
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Service feedbacks by rating fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

export const ServiceFeedbackController = {
  createServiceFeedback,
  getAllServiceFeedbacks,
  getSingleServiceFeedback,
  updateServiceFeedback,
  deleteServiceFeedback,
  getServiceFeedbacksByClient,
  getServiceFeedbacksByRating,
};
