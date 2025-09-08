import status from "http-status";
import { AgentFeedbackServices } from "./agentFeedback.service";
import catchAsync from "../../../utils/catchAsync";
import sendResponse from "../../../utils/sendResponse";
import { User } from "@prisma/client";

const createAgentFeedback = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { agentId } = req.params;
  const result = await AgentFeedbackServices.createAgentFeedback(
    req.body,
    userId, 
    agentId as string
  );
  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Agent feedback created successfully!",
    data: result,
  });
});

const getAllAgentFeedbacks = catchAsync(async (req, res) => {
  const result = await AgentFeedbackServices.getAllAgentFeedbacks(req.query, req.user as User);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedbacks fetched successfully!",
    data: result
  });
});

const getSingleAgentFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await AgentFeedbackServices.getSingleAgentFeedback(id);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedback fetched successfully!",
    data: result,
  });
});

const updateAgentFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await AgentFeedbackServices.updateAgentFeedback(
    id,
    req.body,
    req.user.id as string
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedback updated successfully!",
    data: result,
  });
});

const deleteAgentFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await AgentFeedbackServices.deleteAgentFeedback(
    id,
    req.user as User
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedback deleted successfully!",
    data: result,
  });
});

const getAgentFeedbacksByClient = catchAsync(async (req, res) => {
  const result = await AgentFeedbackServices.getAgentFeedbacksByClient(
    req.query,
    req.user.id as string
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedbacks by client fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAgentFeedbacksByRating = catchAsync(async (req, res) => {
  const { rating } = req.params;
  const result = await AgentFeedbackServices.getAgentFeedbacksByRating(
    Number(rating),
    req.query
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent feedbacks by rating fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

export const AgentFeedbackController = {
  createAgentFeedback,
  getAllAgentFeedbacks,
  getSingleAgentFeedback,
  updateAgentFeedback,
  deleteAgentFeedback,
  getAgentFeedbacksByClient,
  getAgentFeedbacksByRating,
};
