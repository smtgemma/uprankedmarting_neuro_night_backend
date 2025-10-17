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
import { AssignmentStatus, User, UserRole, UserStatus } from "@prisma/client";

const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { Agent: true },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(status.NOT_FOUND, "User is banned!");
  }

  const isPasswordMatched = await passwordCompare(password, user.password);
  if (!isPasswordMatched) {
    throw new ApiError(status.UNAUTHORIZED, "Password is incorrect!");
  }

  if (!user.isVerified) {
    const { otp, expiresAt } = generateOTPData(4, 5);
    await prisma.user.update({
      where: { email },
      data: { otp, otpExpiresAt: expiresAt, isResentOtp: true },
    });

    await sendEmail(user.email, otp, true);

    return {
      isVerified: false,
      message:
        "User is not verified! We sent a verification OTP to your email address.",
    };
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    sip: {
      sip_password: user.Agent?.sip_password,
      sip_username: user.Agent?.sip_username,
      sip_address: user.Agent?.sip_address,
    },
  };

  return {
    isVerified: true,
    accessToken: jwtHelpers.createToken(
      jwtPayload,
      config.jwt.access.secret as string,
      config.jwt.access.expiresIn as string
    ),
    refreshToken: jwtHelpers.createToken(
      jwtPayload,
      config.jwt.refresh.secret as string,
      config.jwt.refresh.expiresIn as string
    ),
  };
};

const verifyOTP = async (
  email: string,
  otp: number,
  isVerification: boolean = true
) => {
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
    throw new ApiError(
      status.BAD_REQUEST,
      "User is not eligible for password reset!"
    );
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
    message: isVerification
      ? "Email verified successfully!"
      : "OTP verified successfully!",
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
    message:
      "We have sent a password reset OTP to your email address. Please check your inbox.",
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
    throw new ApiError(
      status.BAD_REQUEST,
      "User is not eligible for password reset!"
    );
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

  // if (user.isVerified && !user.isResetPassword) {
  //   throw new ApiError(
  //     status.BAD_REQUEST,
  //     "User is already verified and not in password reset process!"
  //   );
  // }

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
    message:
      "A new OTP has been sent to your email address. Please check your inbox.",
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
    include: {
      Agent: true,
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

  const agentInfo = user?.Agent;

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified ?? false,
    sip: {
      sip_password: agentInfo?.sip_password,
      sip_username: agentInfo?.sip_username,
      sip_address: agentInfo?.sip_address,
    },
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
    },
    include: {
      Agent: {
        select: {
          id: true,
          userId: true,
          status: true,
          sip_address: true,
          sip_username: true,
          sip_password: true,
          skills: true,
          employeeId: true,
          workEndTime: true,
          workStartTime: true,
          successCalls: true,
          droppedCalls: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      ownedOrganization: {
        // "id": "68c220255294a7faf37c168d",
        //     "name": "test org for call",
        //     "industry": "information-technology",
        //     "address": "House 23, Road 7, Banani Dhaka",
        //     "websiteLink": "https://techinnovatorsbd.com",
        //     "organizationNumber": "+18633445510",
        //     "ownerId": "68c220235294a7faf37c168c",
        //     "agentVoiceUrl": null,
        //     "leadQuestions": [],
        //     "createdAt": "2025-09-11T01:04:37.276Z",
        //     "updatedAt": "2025-09-14T19:27:02.564Z"
        select: {
          id: true,
          name: true,
          industry: true,
          address: true,
          websiteLink: true,
          organizationNumber: true,
          ownerId: true,
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              amount: true,
              paymentStatus: true,
              status: true,
              planLevel: true,
              purchasedNumber: true,
            },
          },
        },
      },
    },
  });


  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const id = user?.id;
  // Get call statistics for the user (only if they're an agent)
  let callStatistics = null;
  if (user?.Agent) {
    const [totalCallStats, totalSuccessStats, todayStats] = await Promise.all([
      // Total  call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
        },
        _count: { id: true },
        _avg: { recording_duration: true },
        _sum: { recording_duration: true },
      }),

      // Total success call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
          call_status: "completed",
        },
        _count: { id: true },
        _avg: { recording_duration: true },
        _sum: { recording_duration: true },
      }),

      // Today's call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
          call_status: "completed",
          call_time: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _count: { id: true },
        _avg: { recording_duration: true },
      }),
    ]);

    // totalCalls: agent.callStatistics.totalCalls ?? 0,
    // avgCallDuration: agent.callStatistics.avgCallDuration,
    // todaySuccessCalls: agent.callStatistics.todaySuccessCalls,
    // totalCallDuration: agent.callStatistics.totalCallDuration,
    // totalSuccessCalls: agent.callStatistics.totalSuccessCalls,
    // totalDropCalls: agent.callStatistics.droppedCalls ?? 0,

    callStatistics = {
      totalCalls: totalCallStats._count.id || 0,
      avgCallDuration: Math.round(
        totalSuccessStats._avg.recording_duration || 0
      ),
      todaySuccessCalls: todayStats._count.id || 0,
      totalSuccessCalls: totalSuccessStats._count.id || 0,
      totalSuccessCallDuration: totalSuccessStats._sum.recording_duration || 0,
      // todayAvgCallDuration: Math.round(todayStats._avg.recording_duration || 0),
    };
  }

  const { password, ...rest } = user;

  return {
    ...rest,
    callStatistics: callStatistics || {
      totalSuccessCalls: 0,
      totalCallDuration: 0,
      avgCallDuration: 0,
      todaySuccessCalls: 0,
    },
  };
};

// const getSingleUser = async (id: string) => {
//   const user = await prisma.user.findFirst({
//     where: {
//       id,
//       isDeleted: false,
//     },
//     include: {
//       Agent: true,
//       ownedOrganization: true,
//     },
//   });

//   if (!user) {
//     throw new ApiError(status.NOT_FOUND, "User not found");
//   }

//   let Agent = null;
//   if (user.Agent) {
//     Agent = {
//       ...user.Agent,
//       sip_password: user.Agent.sip_password ? "********" : null, // Hide sensitive field
//     };
//   }

//   // remove password from user object
//   const { password, ...restUser } = user;

//   return {
//     ...restUser,
//     Agent,
//   };
// };
const getSingleUser = async (id: string, AuthUser: User) => {
  let org_admin_Info = null;
  if (AuthUser.role === UserRole.organization_admin) {
    org_admin_Info = await prisma.user.findFirst({
      where: {
        id: AuthUser.id,
      },
      select: {
        id: true,
        ownedOrganization: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id,
      status: UserStatus.ACTIVE
    },
    include: {
      Agent: {
        select: {
          id: true,
          userId: true,
          status: true,
          sip_address: true,
          sip_username: true,
          sip_password: true,
          skills: true,
          employeeId: true,
          workEndTime: true,
          workStartTime: true,
          successCalls: true,
          droppedCalls: true,
          createdAt: true,
          updatedAt: true,
          assignments: {
            where: {
              status: AssignmentStatus.ASSIGNED
            },
            select: {
              organizationId: true,
              assignedAt: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
      },
      ownedOrganization: true,
    },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  let Agent = null;
  if (user.Agent) {
    // Check if agent is assigned to the org admin's organization
    const isOwnOrganization = user.Agent.assignments.some(
      assignment => assignment.organizationId === org_admin_Info?.ownedOrganization?.id
    );

    Agent = {
      ...user.Agent,
      sip_password: !user.Agent.sip_password
        ? "********"
        : AuthUser.role === UserRole.super_admin
          ? user.Agent.sip_password
          : AuthUser.role === UserRole.organization_admin && isOwnOrganization
            ? user.Agent.sip_password
            : "********",
    };
  }

  // remove password from user object
  const { password, ...restUser } = user;

  return {
    ...restUser,
    otp: "********",
    Agent,
  };
};

const getSingleAgentInfo = async (id: string, AuthUser: User) => {
  let org_admin_Info = null;
  if (AuthUser.role === UserRole.organization_admin) {
    org_admin_Info = await prisma.user.findFirst({
      where: {
        id: AuthUser.id,
      },
      select: {
        id: true,
        ownedOrganization: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id,
      status: UserStatus.ACTIVE
    },
    include: {
      Agent: {
        include: {
          assignments: {
            where: {
              status: AssignmentStatus.ASSIGNED
            },
            select: {
              organizationId: true,
              assignedAt: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  industry: true
                }
              }
            }
          }
        }
      },
      ownedOrganization: true,
    },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  console.log("user", user);

  let Agent = null;
  if (user.Agent) {
    // Check if agent is assigned to the org admin's organization
    const isOwnOrganization = user.Agent.assignments.some(
      assignment => assignment.organizationId === org_admin_Info?.ownedOrganization?.id
    );

    console.log("isOwnOrganization", isOwnOrganization);

    Agent = {
      ...user.Agent,
      sip_password: !user.Agent.sip_password
        ? "********"
        : AuthUser.role === UserRole.super_admin
          ? user.Agent.sip_password
          : AuthUser.role === UserRole.organization_admin && isOwnOrganization
            ? user.Agent.sip_password
            : "********",
    };
  }

  // Get call statistics for the user (only if they're an agent)
  let callStatistics = null;
  if (user?.Agent) {
    const [totalCallStats, totalSuccessStats, todayStats] = await Promise.all([
      // Total call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
        },
        _count: { id: true },
        _avg: { recording_duration: true },
        _sum: { recording_duration: true },
      }),

      // Total success call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
          call_status: "completed",
        },
        _count: { id: true },
        _avg: { recording_duration: true },
        _sum: { recording_duration: true },
      }),

      // Today's call statistics
      prisma.call.aggregate({
        where: {
          agentId: id,
          call_status: "completed",
          call_time: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _count: { id: true },
        _avg: { recording_duration: true },
      }),
    ]);

    callStatistics = {
      totalCalls: totalCallStats._count.id || 0,
      avgCallDuration: Math.round(
        totalSuccessStats._avg.recording_duration || 0
      ),
      todaySuccessCalls: todayStats._count.id || 0,
      totalSuccessCalls: totalSuccessStats._count.id || 0,
      totalSuccessCallDuration: totalSuccessStats._sum.recording_duration || 0,
    };
  }

  // remove password from user object
  const { password, ...restUser } = user;

  return {
    ...restUser,
    otp: "********",
    Agent,
    callStatistics: callStatistics || {
      totalSuccessCalls: 0,
      totalCallDuration: 0,
      avgCallDuration: 0,
      todaySuccessCalls: 0,
    },
  };
};

export const AuthService = {
  getMe,
  // getSingleUserForAdmin,
  getSingleUser,
  getSingleAgentInfo,
  loginUser,
  verifyOTP,
  refreshToken,
  resetPasswordWithOTP,
  changePassword,
  forgotPassword,
  resendOTP,
};
