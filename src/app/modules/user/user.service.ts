import status from "http-status";
import prisma from "../../utils/prisma";
import ApiError from "../../errors/AppError";
import {
  AgentStatus,
  employmentType,
  User,
  UserRole,
  UserStatus,
} from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import { hashPassword } from "../../helpers/hashPassword";
import { generateOTPData } from "../../utils/otp";
import { sendEmail } from "../../utils/sendEmail";
import { generateUniqueUsernameFromEmail } from "../../utils/generateUniqueSlug";
import { TwilioSipService } from "../sip/sip.service";
import { sendAgentWelcomeEmail } from "../../utils/sendAgentWelcomeEmail";

const createUserIntoDB = async (payload: any) => {
  const { userData, organizationData } = payload;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: userData.email }, { phone: userData.phone }],
    },
  });
  if (existingUser) {
    throw new ApiError(
      status.BAD_REQUEST,
      "User with this email or phone already exists!"
    );
  }

  const hashedPassword = await hashPassword(userData.password);
  const { otp, expiresAt } = generateOTPData(4, 5);

  const userPayload = {
    ...userData,
    role: UserRole.organization_admin,
    password: hashedPassword,
    isVerified: false,
    otp,
    otpExpiresAt: expiresAt,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({ data: userPayload });

      await sendEmail(userData.email, otp, true);

      let createdOrganization = null;
      if (organizationData) {
        const existingOrganization = await tx.organization.findFirst({
          where: {
            ownerId: createdUser?.id,
          },
        });

        if (existingOrganization) {
          throw new ApiError(
            status.BAD_REQUEST,
            "Organization with this owner already exists!"
          );
        }

        createdOrganization = await tx.organization.create({
          data: {
            ...organizationData,
            ownerId: createdUser?.id,
          },
        });

        await tx.user.update({
          where: { id: createdUser.id },
          data: {
            ownedOrganization: { connect: { id: createdOrganization.id } },
          },
        });
      }

      return {
        user: { ...createdUser, password: undefined },
        organization: createdOrganization,
      };
    });

    return {
      ...result,
      message:
        "We have sent a verification email with an OTP to your email address. Please check your inbox.",
    };
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new ApiError(
        status.BAD_REQUEST,
        "Duplicate record exists in database."
      );
    }
    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to create user: " + error.message
    );
  }
};

const createAgentIntoDB = async (payload: any) => {
  const { userData, agentData } = payload;

  if (!userData?.email || !userData?.phone) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Email and phone are required fields"
    );
  }

  if (!agentData?.sip_domain || !agentData?.sip_password) {
    throw new ApiError(
      status.BAD_REQUEST,
      "SIP domain and password are required"
    );
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: userData.email }, { phone: userData.phone }],
      },
    });

    if (existingUser) {
      throw new ApiError(
        status.BAD_REQUEST,
        "User with this email or phone already exists!"
      );
    }

    const hashedPassword = await hashPassword("123456");
    const userName = await generateUniqueUsernameFromEmail(userData.email);
    const sip_domain = agentData.sip_domain;
    const password = agentData.sip_password;

    const sipInfo = await TwilioSipService.createSipEndpoint({
      userName,
      password,
      sip_domain,
    });

    const result = await prisma.$transaction(async (tx) => {
      const existingUserInTx = await tx.user.findFirst({
        where: {
          OR: [{ email: userData.email }, { phone: userData.phone }],
        },
      });

      if (existingUserInTx) {
        throw new ApiError(
          status.BAD_REQUEST,
          "User with this email or phone already exists!"
        );
      }

      const userPayload = {
        name: userData.name.trim(),
        bio: userData.bio?.trim() || "",
        email: userData.email.toLowerCase().trim(),
        phone: userData.phone.trim(),
        role: UserRole.agent,
        password: hashedPassword,
        isVerified: true,
      };

      const createdUser = await tx.user.create({
        data: userPayload,
      });

      const agentPayload = {
        userId: createdUser.id,
        dateOfBirth: new Date(agentData.dateOfBirth),
        gender: agentData.gender,
        address: agentData.address?.trim(),
        emergencyPhone: agentData.emergencyPhone?.trim() || "",
        ssn: agentData.ssn,
        skills: agentData.skills || [],
        sip_address: sipInfo?.fullSipUri,
        sip_username: userName,
        sip_password: password,
        jobTitle: agentData.jobTitle?.trim() || "Customer Service Agent",
        employmentType: agentData.employmentType || employmentType.full_time,
        department: agentData.department?.trim() || "Customer Service",
        workStartTime: agentData.workStartTime,
        workEndTime: agentData.workEndTime,
        startWorkDateTime: agentData.startWorkDateTime
          ? new Date(agentData.startWorkDateTime)
          : null,
        endWorkDateTime: agentData.endWorkDateTime
          ? new Date(agentData.endWorkDateTime)
          : null,
        totalCalls: 0,
        successCalls: 0,
        droppedCalls: 0,
      };

      const EmailPayload = {
        name: createdUser.name,
        email: createdUser.email,
        phone: createdUser.phone,
        password: userData.password,
        sip_address: sipInfo?.fullSipUri,
        sip_username: userName,
        sip_password: password,
      };

      const createdAgent = await tx.agent.create({
        data: agentPayload,
      });

      await sendAgentWelcomeEmail(createdUser.email, EmailPayload);

      return {
        user: { ...createdUser, password: undefined },
        agent: createdAgent,
      };
    });

    return {
      ...result,
      message: "Agent created successfully!",
    };
  } catch (error: any) {
    console.error("Error creating agent:", error);

    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      const fieldMap: { [key: string]: string } = {
        email: "Email",
        phone: "Phone",
        userId: "User ID",
        twilioIdentity: "Twilio Identity",
        employeeId: "Employee ID",
      };

      const fieldName = fieldMap[field] || field || "Field";
      throw new ApiError(status.BAD_REQUEST, `${fieldName} already exists`);
    }

    if (error instanceof ApiError) throw error;

    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to create agent: " + error.message
    );
  }
};

const verifyOTP = async (email: string, otp: number) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (user.isVerified) {
    throw new ApiError(status.BAD_REQUEST, "User is already verified!");
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

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isDeleted: false },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
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

  await sendEmail(email, otp, false); // isVerification: false for password reset

  return {
    message: "Password reset OTP sent to your email. Please check your inbox.",
  };
};

const resetPassword = async (email: string, otp: number, newPassword: string) => {
  const user = await prisma.user.findUnique({
    where: { email, isDeleted: false },
  });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
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

  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      otp: null,
      otpExpiresAt: null,
      isResentOtp: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return {
    user: updatedUser,
    message: "Password reset successfully!",
  };
};

const getAllUserFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email", "phone"])
    .filter()
    .rawFilter({ isDeleted: false, role: query?.role })
    .sort()
    .include({
      Agent: true,
      ownedOrganization: true,
    })
    .paginate();

  const [result, meta] = await Promise.all([
    userQuery.execute(),
    userQuery.countTotal(),
  ]);

  if (!result.length) {
    throw new ApiError(status.NOT_FOUND, "No users found!");
  }

  const data = result.map((user: User) => {
    const { password, ...rest } = user;
    return rest;
  });

  return {
    meta,
    data,
  };
};

const updateUserIntoDB = async (user: User, payload: any) => {
  const currentUserId = user?.id;
  const isUserExist = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      ownedOrganization: user?.role === UserRole.organization_admin,
      Agent: user?.role !== UserRole.organization_admin,
    },
  });

  if (!isUserExist) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }
  if (!payload.image && isUserExist.image) {
    payload.image = isUserExist.image;
  }

  const userData = payload?.userData;
  const organizationData = payload?.organizationData;

  if (userData?.email || userData?.phone) {
    const checkIfNumberOrEmailExists = await prisma.user.findFirst({
      where: {
        AND: [
          {
            OR: [
              userData?.email ? { email: userData.email } : undefined,
              userData?.phone ? { phone: userData.phone } : undefined,
            ].filter(Boolean) as any,
          },
          {
            id: { not: currentUserId },
          },
        ],
      },
    });

    if (checkIfNumberOrEmailExists) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Email or phone number already exists!"
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: currentUserId },
    data: {
      name: userData?.name ?? isUserExist.name,
      image: userData?.image ?? isUserExist.image,
      email: userData?.email ?? isUserExist.email,
      phone: userData?.phone ?? isUserExist.phone,
    },
  });

  if (organizationData && isUserExist?.ownedOrganization) {
    await prisma.organization.update({
      where: { id: isUserExist.ownedOrganization.id },
      data: {
        name: organizationData?.name ?? isUserExist.ownedOrganization.name,
        industry:
          organizationData?.industry ?? isUserExist.ownedOrganization.industry,
        address:
          organizationData?.address ?? isUserExist.ownedOrganization.address,
        websiteLink:
          organizationData?.websiteLink ??
          isUserExist.ownedOrganization.websiteLink,
      },
    });
  }

  const { password: updatedPassword, ...restData } = updatedUser;

  return restData;
};

const updateAgentInfo = async (user: User, agentId: string, payload: any) => {
  const currentUserRole = user?.role;

  if (currentUserRole !== UserRole.super_admin) {
    throw new ApiError(
      status.FORBIDDEN,
      "Only super admin can update agent information"
    );
  }

  const { userData, agentData } = payload;

  if (!agentId) {
    throw new ApiError(
      status.BAD_REQUEST,
      "targetUserId is required to update agent information"
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: agentId, isDeleted: false },
    include: {
      Agent: true,
    },
  });

  if (!targetUser) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (!targetUser.Agent) {
    throw new ApiError(status.BAD_REQUEST, "Target user is not an agent");
  }

  if (
    targetUser?.Agent?.ssn === agentData?.ssn ||
    targetUser?.Agent?.emergencyPhone === agentData?.emergencyPhone
  ) {
    throw new ApiError(
      status.BAD_REQUEST,
      "SSN or Emergency Phone number already exists!"
    );
  }

  const result = await prisma.$transaction(async (transactionClient) => {
    let updatedUser = targetUser;
    let updatedAgent = targetUser.Agent;

    if (userData) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: userData.email }, { phone: userData.phone }],
        },
        include: {
          Agent: true,
        },
      });
      if (existingUser) {
        throw new ApiError(
          status.BAD_REQUEST,
          "User with this email or phone already exists!"
        );
      }

      updatedUser = await transactionClient.user.update({
        where: { id: agentId },
        data: {
          name: userData.name,
          bio: userData.bio,
          phone: userData.phone,
          image: payload?.image,
          role: userData.role,
        },
        include: {
          Agent: true,
        },
      });
    }

    if (agentData) {
      updatedAgent = await transactionClient.agent.update({
        where: { userId: agentId },
        data: {
          ...agentData,
          emergencyPhone: agentData.emergencyPhone,
          ssn: agentData.ssn,
          skills: agentData.skills,
          dateOfBirth: new Date(agentData.dateOfBirth),
        },
      });
    }

    return { ...updatedUser, password: null };
  });

  return result;
};

const updateAgentSpecificInfo = async (user: User, payload: any) => {
  if (!payload?.image) {
    throw new ApiError(status.BAD_REQUEST, "Image is required");
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: user.id,
      isDeleted: false,
      role: UserRole.agent,
    },
    include: {
      Agent: true,
    },
  });

  if (!targetUser) {
    throw new ApiError(status.NOT_FOUND, "Agent not found!");
  }

  if (!targetUser.Agent) {
    throw new ApiError(status.BAD_REQUEST, "User is not registered as an agent");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      image: payload?.image,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      bio: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      Agent: {
        select: {
          id: true,
          status: true,
          skills: true,
          isAvailable: true,
          totalCalls: true,
          successCalls: true,
          droppedCalls: true,
        },
      },
    },
  });

  return updatedUser;
};

const getSingleUserByIdFromDB = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
    include: {
      Agent: true,
      ownedOrganization: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { password, ...rest } = user;

  return rest;
};

const updateUserRoleStatusByAdminIntoDB = async (
  authUser: User,
  user_id: string,
  payload: Partial<User>
) => {
  const isUserExist = await prisma.user.findUnique({
    where: { id: user_id },
  });

  if (!isUserExist) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  const { role, status: UserCurrentStatus, isDeleted } = payload;

  const updatedData: Partial<User> = {};

  if (authUser.role === UserRole.super_admin) {
    updatedData.role = role;
    updatedData.status =
      isDeleted === true ? UserStatus.DELETED : UserCurrentStatus;
    updatedData.isDeleted = isDeleted;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user_id },
    data: updatedData,
    include: { Agent: true, ownedOrganization: true },
  });

  const { password, ...restData } = updatedUser;

  return restData;
};

export const UserService = {
  createUserIntoDB,
  createAgentIntoDB,
  updateAgentSpecificInfo,
  verifyOTP,
  getAllUserFromDB,
  updateUserIntoDB,
  updateAgentInfo,
  getSingleUserByIdFromDB,
  updateUserRoleStatusByAdminIntoDB,
  forgotPassword,
  resetPassword,
};