import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AuthService } from "./auth.service";
import config from "../../config";

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const result = await AuthService.loginUser(email, password);

  const { accessToken, refreshToken, isVerified , message } = result;

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: config.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: "User logged in successfully!",
    data: { accessToken, refreshToken , isVerified , message},
  });
});

const verifyOTP = catchAsync(async (req, res) => {
  const { email, otp, isVerification = true } = req.body;

  const result = await AuthService.verifyOTP(email, otp, isVerification);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: result.user,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const email = req.user?.email as string;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const result = await AuthService.changePassword(
    email,
    currentPassword,
    newPassword,
    confirmPassword
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthService.forgotPassword(email);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

const resetPasswordWithOTP = catchAsync(async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  const result = await AuthService.resetPasswordWithOTP(
    email,
    otp,
    newPassword,
    confirmPassword
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

const resendOTP = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await AuthService.resendOTP(email);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  const result = await AuthService.refreshToken(refreshToken);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Access token is retrieved successfully!",
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const email = req.user?.email as string;

  const result = await AuthService.getMe(email);

  sendResponse(res, {
    statusCode: status.OK,
    message: "User fetched successfully!",
    data: result,
  });
});

export const AuthController = {
  login,
  verifyOTP,
  changePassword,
  forgotPassword,
  resetPasswordWithOTP,
  resendOTP,
  refreshToken,
  getMe,
};