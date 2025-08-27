import status from "http-status";
import config from "../../config";
import prisma from "../../utils/prisma";
import ApiError from "../../errors/AppError";
import { User, UserRole, UserStatus } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import { hashPassword } from "../../helpers/hashPassword";

const createUserIntoDB = async (payload: any) => {
  const { userData, organizationData, agentData } = payload;

  // ===== Check for existing user =====
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

  const userPayload = {
    ...userData,
    role: organizationData ? UserRole.organization_admin : UserRole.agent,
    password: hashedPassword,
  };

  // console.log(userPayload)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // ===== Create User =====
      const createdUser = await tx.user.create({ data: userPayload });

      let createdOrganization = null;
      if (organizationData) {
        // Ensure unique organizationNumber
        const orgNumber =
          organizationData.organizationNumber || `ORG-${Date.now()}`;

        const existingOrg = await tx.organization.findUnique({
          where: { organizationNumber: orgNumber },
        });

        if (existingOrg) {
          throw new ApiError(
            status.BAD_REQUEST,
            `Organization with number ${orgNumber} already exists!`
          );
        }

        createdOrganization = await tx.organization.create({
          data: {
            ...organizationData,
            ownerId: createdUser.id,
            organizationNumber: orgNumber,
          },
        });

        // Connect user to organization
        await tx.user.update({
          where: { id: createdUser.id },
          data: {
            ownedOrganization: { connect: { id: createdOrganization.id } },
          },
        });
      }

      let createdAgent = null;
      if (agentData) {
        createdAgent = await tx.agent.create({
          data: {
            ...agentData,
            userId: createdUser.id,
            dateOfBirth: new Date(agentData.dateOfBirth),
            assignTo: createdOrganization?.id || null,
            status: "OFFLINE", // Default AgentStatus
            isAvailable: agentData.isAvailable ?? true,
          },
        });
      }

      return { user: { ...createdUser, password: undefined }, organization: createdOrganization, agent: createdAgent };
    });

    return result;
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

// user.service.ts
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

  const { userData, organizationData } = payload;

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

  //  Update User with only provided fields
  const updatedUser = await prisma.user.update({
    where: { id: currentUserId },
    data: {
      name: userData?.name ?? isUserExist.name,
      image: userData?.image ?? isUserExist.image,
      email: userData?.email ?? isUserExist.email,
      phone: userData?.phone ?? isUserExist.phone,
    },
  });

  //  Update Organization safely with fallbacks
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
  // if (
  //   targetUser?.Agent?.ssn === agentData?.ssn ||
  //   targetUser?.Agent?.emergencyPhone === agentData?.emergencyPhone
  // ) {
  //   throw new ApiError(
  //     status.BAD_REQUEST,
  //     "SSN or Emergency Phone number already exists!"
  //   );
  // }

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

    return {...updatedUser, password: null};
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
