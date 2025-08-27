import status from "http-status";
import config from "../../config";
import prisma from "../../utils/prisma";
import ApiError from "../../errors/AppError";
import { User, UserRole, UserStatus } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import { hashPassword } from "../../helpers/hashPassword";
import { generateVerificationToken } from "../../utils/emailverify";
import { sendEmail } from "../../utils/sendEmail";

const createUserIntoDB = async (payload: any) => {
  const userData = payload?.userData;
  const organizationData = payload?.organizationData;
  const agentData = payload?.agentData;

  if (!userData) {
    throw new ApiError(status.BAD_REQUEST, "User data is required");
  }

  // Check if user exists by email
  const isUserExistByEmail = await prisma.user.findFirst({
    where: { email: userData.email },
  });

  if (isUserExistByEmail) {
    throw new ApiError(
      status.BAD_REQUEST,
      `User with this email: ${userData.email} already exists!`
    );
  }

  // Check if phone number exists
  const isUserExistByPhone = await prisma.user.findFirst({
    where: { phone: userData.phone },
  });

  if (isUserExistByPhone) {
    throw new ApiError(
      status.BAD_REQUEST,
      `User with this phone number: ${userData.phone} already exists!`
    );
  }

  // ✅ NEW: Check if organization number already exists
  if (organizationData?.organizationNumber) {
    const isOrganizationExist = await prisma.organization.findFirst({
      where: { organizationNumber: organizationData.organizationNumber },
    });

    if (isOrganizationExist) {
      throw new ApiError(
        status.BAD_REQUEST,
        `Organization with number: ${organizationData.organizationNumber} already exists!`
      );
    }
  }

  const hashedPassword = await hashPassword(userData.password);

  const userPayload = {
    ...userData,
    password: hashedPassword,
  };

  try {
    const result = await prisma.$transaction(async (transactionClient) => {
      const createUser = await transactionClient.user.create({
        data: userPayload,
      });

      let createdOrganization = null;
      let createdAgent = null;

      if (organizationData) {
        // ✅ Double check within transaction (race condition protection)
        const existingOrgInTransaction =
          await transactionClient.organization.findFirst({
            where: { organizationNumber: organizationData.organizationNumber },
          });

        if (existingOrgInTransaction) {
          throw new ApiError(
            status.BAD_REQUEST,
            `Organization with number: ${organizationData.organizationNumber} already exists!`
          );
        }

        createdOrganization = await transactionClient.organization.create({
          data: {
            ...organizationData,
            ownerId: createUser.id,
          },
        });

        await transactionClient.user.update({
          where: { id: createUser.id },
          data: {
            ownedOrganization: {
              connect: { id: createdOrganization.id },
            },
          },
        });
      }

      if (agentData) {
        const agentPayload = {
          ...agentData,
          userId: createUser.id,
          dateOfBirth: new Date(agentData.dateOfBirth),
          assignTo: null,
        };

        createdAgent = await transactionClient.agent.create({
          data: agentPayload,
        });
      }

      // try {
      //   const token = await generateVerificationToken(createUser.email);
      //   const verificationUrl = `http://localhost:3000/verify?token=${token}`;

      //   await sendEmail(
      //     createUser.email,
      //     "Verify Your Email within 10 Minutes",
      //     `
      //       <h2>Verify your account</h2>
      //       <p>Click the link below to verify your email address:</p>
      //       <a href="${verificationUrl}" target="_blank" style="color: blue;">${verificationUrl}</a>
      //       <p>This link will expire in 10 minutes.</p>
      //     `
      //   );
      // } catch (emailError) {
      //   console.error("Email sending failed:", emailError);
      // }

      const result = {
        user: createUser,
        organization: createdOrganization,
        agent: createdAgent,
      };
      // console.log(result);
      return result;
    });

    return result;
  } catch (error: any) {
    console.log(error);
    // Handle specific Prisma errors
    if (error.code === "P2002") {
      throw new ApiError(
        status.BAD_REQUEST,
        "A record with this organization number already exists"
      );
    }
    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to create user: " + error.message
    );
  }
};

const getAllUserFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email", "phone",])
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

// user.service.ts
const updateUserIntoDB = async (user: User, payload: any) => {
  const currentUserId = user?.id;

  const isUserExist = await prisma.user.findUnique({
    where: { id: currentUserId },
  });

  if (!isUserExist) {
    throw new ApiError(status.NOT_FOUND, "User not found!");
  }

  if (!payload.image && isUserExist.image) {
    payload.image = isUserExist.image;
  }

  const { password, ...rest } = payload;

  // Prepare update data
  const updatedData: Partial<User> = {
    ...rest,
  };

  // Check for duplicate email or phone (excluding current user)
  const checkIfNumberOrEmailExists = await prisma.user.findFirst({
    where: {
      AND: [
        {
          OR: [{ email: updatedData.email }, { phone: updatedData.phone }],
        },
        {
          id: { not: currentUserId }, // Exclude the current user being updated
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

  const updatedUser = await prisma.user.update({
    where: { id: currentUserId },
    data: updatedData,
  });

  const { password: updatedPassword, ...restData } = updatedUser;

  return restData;
};

const updateAgentInfo = async (user: User, agentId: string, payload: any) => {
  const currentUserRole = user?.role;

  // Only super_admin can access this function
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

  // Check if target user exists and is an agent
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

  // console.log(targetUser);
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

    // Update user data if provided
    if (userData) {
      // Check for duplicate email or phone
      const checkIfNumberOrEmailExists = await transactionClient.user.findFirst(
        {
          where: {
            phone: userData.phone,
          },
        }
      );

      // console.log(checkIfNumberOrEmailExists)

      if (checkIfNumberOrEmailExists) {
        throw new ApiError(status.BAD_REQUEST, "Phone number already exists!");
      }

      updatedUser = await transactionClient.user.update({
        where: { id: agentId },
        data: {
          name: userData.name,
          bio: userData.bio,
          phone: userData.phone,
          image: payload?.image,
          role: userData.role, // Super admin can change role
        },
        include: {
          Agent: true,
        },
      });
    }

    // Update agent data if provided
    if (agentData) {
      updatedAgent = await transactionClient.agent.update({
        where: { userId: agentId },
        data: {
          dateOfBirth: agentData.dateOfBirth
            ? new Date(agentData.dateOfBirth)
            : undefined,
          gender: agentData.gender,
          address: agentData.address,
          emergencyPhone: agentData.emergencyPhone,
          ssn: agentData.ssn,
          skills: agentData.skills,
          employeeId: agentData.employeeId,
          officeHours: agentData.officeHours,
          isAvailable: agentData.isAvailable,
          assignTo: agentData.assignTo, // Super admin can reassign to different organization
        },
      });
    }

    return {
      user: updatedUser,
      agent: updatedAgent,
    };
  });

  return result;
};
const getSingleUserByIdFromDB = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
    include: {
      Agent: true, // If user is an agent, get agent details
      ownedOrganization: true, // If user owns an organization
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

  // Initialize the update data object
  const updatedData: Partial<User> = {};

  // Check permissions based on admin role
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
  getAllUserFromDB,
  updateUserIntoDB,
  updateAgentInfo,
  getSingleUserByIdFromDB,
  updateUserRoleStatusByAdminIntoDB,
};
