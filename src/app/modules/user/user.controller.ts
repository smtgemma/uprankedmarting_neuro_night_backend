import status from "http-status";
import config from "../../config";
import { UserService } from "./user.service";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { User } from "@prisma/client";

const createUser = catchAsync(async (req, res) => {
  const result = await UserService.createUserIntoDB(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: result.message || "User registered successfully!",
    data: {
      user: result.user,
      organization: result.organization
    },
  });
});

// Create agent
const createAgent = catchAsync(async (req, res) => {
  const result = await UserService.createAgentIntoDB(req.body, req.user as User);
  
  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Agent created successfully!",
    data: result,
  });
});

const verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  const result = await UserService.verifyOTP(email, otp);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: result.user,
  });
});

const getAllUser = catchAsync(async (req, res) => {
  const result = await UserService.getAllUserFromDB(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Users are retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const updateUser = catchAsync(async (req, res) => {
  const user = req.user;

  const result = await UserService.updateUserIntoDB(user as User, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    message: "User updated successfully!",
    data: result,
  });
});

const getSingleUserById = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const result = await UserService.getSingleUserByIdFromDB(userId);

  sendResponse(res, {
    statusCode: status.OK,
    message: "User retrieved successfully!",
    data: result,
  });
});

const updateAgentInfo = catchAsync(async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const result = await UserService.updateAgentInfo(user as User, id, req.body);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent info updated successfully!",
    data: result,
  });
});

const updateAgentSpecificInfo = catchAsync(async (req, res) => {
  const user = req.user;
  const result = await UserService.updateAgentSpecificInfo(user as User, req.body);
  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent info updated successfully!",
    data: result,
  });
});

const updateUserStatusByAdminIntoDB = catchAsync(async (req, res) => {
  const authUser = req.user;
  const { userId } = req.params;
  const result = await UserService.updateUserStatusByAdminIntoDB(
    authUser as User,
    userId,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "User role/status updated successfully!",
    data: result,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await UserService.forgotPassword(email);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const result = await UserService.resetPassword(email, otp, newPassword);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

export const UserController = {
  verifyOTP,
  createUser,
  createAgent,
  updateAgentSpecificInfo,
  getAllUser,
  updateUser,
  getSingleUserById,
  updateAgentInfo,
  updateUserStatusByAdminIntoDB,
  forgotPassword,
  resetPassword,
};