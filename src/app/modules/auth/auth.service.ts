import status from "http-status";
import config from "../../config";
import prisma from "../../utils/prisma";
import ApiError from "../../errors/AppError";
import { jwtHelpers } from "./../../helpers/jwtHelpers";
import { passwordCompare } from "../../helpers/comparePasswords";
import { hashPassword } from "../../helpers/hashPassword";
import { RefreshPayload } from "./auth.interface";
import { sendEmail } from "../../utils/sendEmail";
import { generateOTPData } from "../../utils/otp";

const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  const isPasswordMatched = await passwordCompare(password, user.password);

  if (!isPasswordMatched) {
    throw new ApiError(status.UNAUTHORIZED, "Password is incorrect!");
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified ?? false,
  };

  if (!user.isVerified) {
    const { otp, expiresAt } = generateOTPData(4, 5); // 4-digit OTP, expires in 5 minutes
    await prisma.user.update({
      where: { email },
      data: {
        otp,
        otpExpiresAt: expiresAt,
        isResentOtp: true,
      },
    });

    await sendEmail(user.email, otp, true);

    throw new ApiError(
      status.UNAUTHORIZED,
      "User is not verified! We have sent a verification OTP to your email address. Please check your inbox."
    );
  }

  const accessToken = jwtHelpers.createToken(
    jwtPayload,
    config.jwt.access.secret as string,
    config.jwt.access.expiresIn as string
  );

  const refreshToken = jwtHelpers.createToken(
    jwtPayload,
    config.jwt.refresh.secret as string,
    config.jwt.refresh.expiresIn as string
  );

  return {
    accessToken,
    refreshToken,
  };
};

const verifyOTP = async (email: string, otp: number, isVerification: boolean = true) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (isVerification && user.isVerified) {
    throw new ApiError(status.BAD_REQUEST, "User is already verified!");
  }

  if (!isVerification && (!user.isResetPassword || !user.canResetPassword)) {
    throw new ApiError(status.BAD_REQUEST, "User is not eligible for password reset!");
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new ApiError(status.BAD_REQUEST, "No OTP found for this user!");
  }

  if (user.otp !== otp) {
    throw new ApiError(status.BAD_REQUEST, "Invalid OTP!");
  }

  if (new Date() > user.otpExpiresAt) {
    throw new ApiError(status.BAD_REQUEST, "OTP has expired!");
  }

  const updateData = isVerification
    ? {
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
        isResentOtp: false,
      }
    : {
        otp: null,
        otpExpiresAt: null,
        isResentOtp: false,
        isResetPassword: false,
        canResetPassword: false,
      };

  const updatedUser = await prisma.user.update({
    where: { email },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
    },
  });

  return {
    user: updatedUser,
    message: isVerification ? "Email verified successfully!" : "OTP verified successfully!",
  };
};

const changePassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (!newPassword) {
    throw new ApiError(status.BAD_REQUEST, "New password is required!");
  }

  if (!confirmPassword) {
    throw new ApiError(status.BAD_REQUEST, "Confirm password is required!");
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(
      status.BAD_REQUEST,
      "New password and confirm password do not match!"
    );
  }

  const isPasswordMatch = await passwordCompare(currentPassword, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(status.UNAUTHORIZED, "Current password is incorrect!");
  }

  const hashedNewPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedNewPassword,
      passwordChangedAt: new Date(),
    },
  });

  return {
    message: "Password changed successfully!",
  };
};

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  const { otp, expiresAt } = generateOTPData(4, 5);

  await prisma.user.update({
    where: { email },
    data: {
      otp,
      otpExpiresAt: expiresAt,
      isResetPassword: true,
      canResetPassword: true,
      isResentOtp: false,
    },
  });

  await sendEmail(user.email, otp, false);

  return {
    message: "We have sent a password reset OTP to your email address. Please check your inbox.",
  };
};

const resetPasswordWithOTP = async (
  email: string,
  otp: number,
  newPassword: string,
  confirmPassword: string
) => {
  if (newPassword !== confirmPassword) {
    throw new ApiError(status.BAD_REQUEST, "Passwords do not match!");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (!user.isResetPassword || !user.canResetPassword) {
    throw new ApiError(status.BAD_REQUEST, "User is not eligible for password reset!");
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new ApiError(status.BAD_REQUEST, "No OTP found for this user!");
  }

  if (user.otp !== otp) {
    throw new ApiError(status.BAD_REQUEST, "Invalid OTP!");
  }

  if (new Date() > user.otpExpiresAt) {
    throw new ApiError(status.BAD_REQUEST, "OTP has expired!");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      isResetPassword: false,
      canResetPassword: false,
      otp: null,
      otpExpiresAt: null,
      isResentOtp: false,
    },
  });

  return {
    message: "Password reset successfully!",
  };
};

const resendOTP = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (user.isVerified && !user.isResetPassword) {
    throw new ApiError(
      status.BAD_REQUEST,
      "User is already verified and not in password reset process!"
    );
  }

  const { otp, expiresAt } = generateOTPData(4, 5);

  await prisma.user.update({
    where: { email },
    data: {
      otp,
      otpExpiresAt: expiresAt,
      isResentOtp: true,
    },
  });

  await sendEmail(user.email, otp, !user.isResetPassword);

  return {
    message: "A new OTP has been sent to your email address. Please check your inbox.",
  };
};

const refreshToken = async (token: string) => {
  const decoded = jwtHelpers.verifyToken(
    token,
    config.jwt.refresh.secret as string
  ) as RefreshPayload;

  const { email, iat } = decoded;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      isVerified: true,
      passwordChangedAt: true,
    },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (
    user.passwordChangedAt &&
    Math.floor(user.passwordChangedAt.getTime() / 1000) > iat
  ) {
    throw new ApiError(
      status.UNAUTHORIZED,
      "Password was changed after this token was issued"
    );
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    image: user?.image,
    isVerified: user.isVerified,
  };

  const accessToken = jwtHelpers.createToken(
    jwtPayload,
    config.jwt.access.secret as string,
    config.jwt.access.expiresIn as string
  );

  return { accessToken };
};

const getMe = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: {
      email: email,
      isDeleted: false,
    },
    include: {
      Agent: true,
      ownedOrganization: true,
    },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const { password, ...rest } = user;

  return rest;
};

export const AuthService = {
  getMe,
  loginUser,
  verifyOTP,
  refreshToken,
  resetPasswordWithOTP,
  changePassword,
  forgotPassword,
  resendOTP,
};