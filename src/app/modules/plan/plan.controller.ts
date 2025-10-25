import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { PlanServices } from "./plan.service";

const createPlan = catchAsync(async (req, res) => {
  const result = await PlanServices.createPlan(req.body);
  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Plan created successfully!",
    data: result,
  });
});

const getAllPlans = catchAsync(async (req, res) => {
  const result = await PlanServices.getAllPlans();
  sendResponse(res, {
    statusCode: status.OK,
    message: "Plans fetched successfully!",
    data: result,
  });
});

const getPlanById = catchAsync(async (req, res) => {
  const result = await PlanServices.getPlanById(req.params.planId);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Plan fetched successfully!",
    data: result,
  });
});

const updatePlan = catchAsync(async (req, res) => {
  const result = await PlanServices.updatePlan(req.params.planId, req.body);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Plan updated successfully!",
    data: result,
  });
});

const deletePlan = catchAsync(async (req, res) => {
  const result = await PlanServices.deletePlan(req.params.planId);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Plan deleted successfully!",
    data: result,
  });
});

export const PlanController = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
