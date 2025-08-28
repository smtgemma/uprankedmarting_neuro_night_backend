import status from "http-status";
import AppError from "../errors/AppError";
import prisma from "./prisma";


export const verifyOTP = async (email: string, otp: number) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found!");
  }

  if (user.isVerified) {
    throw new AppError(status.BAD_REQUEST, "User is already verified!");
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new AppError(status.BAD_REQUEST, "No OTP found for this user!");
  }

  if (user.otp !== otp) {
    throw new AppError(status.BAD_REQUEST, "Invalid OTP!");
  }

  if (new Date() > user.otpExpiresAt) {
    throw new AppError(status.BAD_REQUEST, "OTP has expired!");
  }

  // Update user to mark as verified and clear OTP fields
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      otp: null,
      otpExpiresAt: null,
      isResentOtp: false,
    },
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
    message: "Email verified successfully!",
  };
};