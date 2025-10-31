import status from "http-status";
import prisma from "../../utils/prisma";
import ApiError from "../../errors/AppError";
import { employmentType, User, UserRole, UserStatus } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import { hashPassword } from "../../helpers/hashPassword";
import { generateOTPData } from "../../utils/otp";
import { sendEmail } from "../../utils/sendEmail";
import { generateUniqueUsernameFromEmail } from "../../utils/generateUniqueSlug";
import { TwilioSipService } from "../sip/sip.service";
import { sendAgentWelcomeEmail } from "../../utils/sendAgentWelcomeEmail";
import { parseAnyDate } from "../../utils/Date/parseAnyDate";
import { generateUniqueEmployeeId } from "../../utils/generateUniqueEmployeeId";

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
            ownedOrganization: { connect: { id: createdOrganization?.id } },
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
      if (error.code === "P2002") {
        console.log("Duplicate field:", error.meta?.target);
      }
      throw error;
    }
    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to create user: " + error.message
    );
  }
};

// const createAgentIntoDB = async (payload: any) => {
//   const { userData, agentData } = payload;

//   if (!userData?.email || !userData?.phone) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Email and phone are required fields"
//     );
//   }

//   if (!agentData?.sip_domain || !agentData?.sip_password) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "SIP domain and password are required"
//     );
//   }

//   try {
//     const existingUser = await prisma.user.findFirst({
//       where: {
//         OR: [{ email: userData.email }, { phone: userData.phone }],
//       },
//     });

//     if (existingUser) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "User with this email or phone already exists!"
//       );
//     }

//     // ===== Check for unique emergencyPhone and ssn =====
//     if (agentData.emergencyPhone) {
//       const existingEmergencyPhone = await prisma.agent.findFirst({
//         where: {
//           emergencyPhone: agentData.emergencyPhone.trim(),
//         },
//       });

//       if (existingEmergencyPhone) {
//         throw new ApiError(
//           status.BAD_REQUEST,
//           "Emergency phone number already exists!"
//         );
//       }
//     }

//     if (agentData.ssn) {
//       const existingSSN = await prisma.agent.findFirst({
//         where: {
//           ssn: agentData.ssn,
//         },
//       });

//       if (existingSSN) {
//         throw new ApiError(status.BAD_REQUEST, "SSN already exists!");
//       }
//     }

//     // ===== Generate unique employee ID OUTSIDE transaction =====
//     const employeeId = await generateUniqueEmployeeId();
//     // console.log("Generated Employee ID:", employeeId);

//     const hashedPassword = await hashPassword(userData?.password);
//     const userName = await generateUniqueUsernameFromEmail(userData?.email);
//     const sip_domain = agentData?.sip_domain;
//     const password = agentData?.sip_password;

//     const result = await prisma.$transaction(
//       async (tx) => {
//         // ===== Double-check for existing user INSIDE transaction =====
//         const existingUserInTx = await tx.user.findFirst({
//           where: {
//             OR: [{ email: userData.email }, { phone: userData.phone }],
//           },
//         });

//         if (existingUserInTx) {
//           throw new ApiError(
//             status.BAD_REQUEST,
//             "User with this email or phone already exists!"
//           );
//         }

//         // ===== Double-check for unique emergencyPhone and ssn INSIDE transaction =====
//         if (agentData.emergencyPhone) {
//           const existingEmergencyPhoneInTx = await tx.agent.findFirst({
//             where: {
//               emergencyPhone: agentData.emergencyPhone.trim(),
//             },
//           });

//           if (existingEmergencyPhoneInTx) {
//             throw new ApiError(
//               status.BAD_REQUEST,
//               "Emergency phone number already exists!"
//             );
//           }
//         }

//         if (agentData.ssn) {
//           const existingSSNInTx = await tx.agent.findFirst({
//             where: {
//               ssn: agentData.ssn,
//             },
//           });

//           if (existingSSNInTx) {
//             throw new ApiError(status.BAD_REQUEST, "SSN already exists!");
//           }
//         }

//         const sipInfo = await TwilioSipService.createSipEndpoint({
//           userName,
//           password,
//           sip_domain,
//         });

//         if (!sipInfo) {
//           throw new ApiError(
//             status.INTERNAL_SERVER_ERROR,
//             "Failed to create SIP endpoint"
//           );
//         }

//         // ===== Create User =====
//         const userPayload = {
//           name: userData.name.trim(),
//           bio: userData.bio?.trim() || "",
//           email: userData.email.toLowerCase().trim(),
//           phone: userData.phone.trim(),
//           role: UserRole.agent,
//           password: hashedPassword,
//           isVerified: true,
//         };

//         const createdUser = await tx.user.create({
//           data: userPayload,
//         });

//         // ===== Create Agent =====
//         const agentPayload = {
//           userId: createdUser.id,
//           employeeId: employeeId,
//           dateOfBirth: parseAnyDate(agentData?.dateOfBirth),
//           gender: agentData.gender,
//           address: agentData.address?.trim(),
//           emergencyPhone: agentData.emergencyPhone?.trim() || "",
//           ssn: agentData.ssn,
//           skills: agentData.skills || [],
//           sip_address: sipInfo?.fullSipUri,
//           sip_username: userName,
//           sip_password: password,
//           jobTitle: agentData.jobTitle?.trim() || "Customer Service Agent",
//           employmentType: agentData.employmentType || employmentType.full_time,
//           department: agentData.department?.trim() || "Customer Service",
//           workStartTime: agentData.workStartTime,
//           workEndTime: agentData.workEndTime,
//           startWorkDateTime: parseAnyDate(agentData?.startWorkDateTime),
//           endWorkDateTime: null,
//           successCalls: 0,
//           droppedCalls: 0,
//         };

//         const EmailPayload = {
//           name: createdUser?.name,
//           email: createdUser?.email,
//           phone: createdUser?.phone,
//           password: userData?.password,
//           sip_address: sipInfo?.fullSipUri,
//           sip_username: userName,
//           sip_password: password,
//           employeeId: employeeId,
//         };

//         const createdAgent = await tx.agent.create({
//           data: agentPayload,
//         });

//         await sendAgentWelcomeEmail(createdUser.email, EmailPayload);

//         return {
//           user: { ...createdUser, password: undefined },
//           agent: createdAgent,
//         };
//       },
//       {
//         timeout: 10000, // Increase transaction timeout to 10 seconds
//       }
//     );

//     return result;
//   } catch (error: any) {
//     console.error("Error creating agent:", error);

//     if (error.code === "P2002") {
//       const field = error.meta?.target?.[0];
//       const fieldMap: { [key: string]: string } = {
//         email: "Email",
//         phone: "Phone",
//         userId: "User ID",
//         // twilioIdentity: "Twilio Identity",
//         employeeId: "Employee ID",
//         emergencyPhone: "Emergency Phone",
//         ssn: "SSN",
//       };

//       const fieldName = fieldMap[field] || field || "Field";
//       throw new ApiError(status.BAD_REQUEST, `${fieldName} already exists`);
//     }

//     if (error instanceof ApiError) throw error;

//     throw new ApiError(
//       status.INTERNAL_SERVER_ERROR,
//       "Failed to create agent: " + error.message
//     );
//   }
// };

const createAgentIntoDB = async (payload: any) => {
  const { userData, agentData } = payload;

  if (!userData?.email || !userData?.phone) {
    throw new ApiError(status.BAD_REQUEST, "Email and phone are required fields");
  }

  if (!agentData?.sip_domain || !agentData?.sip_password) {
    throw new ApiError(status.BAD_REQUEST, "SIP domain and password are required");
  }

  let sipInfo = null as any;

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: userData.email }, { phone: userData.phone }] },
    });

    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, "User with this email or phone already exists!");
    }



    // Generate unique employee ID
    const employeeId = await generateUniqueEmployeeId();
    const hashedPassword = await hashPassword(userData?.password);
    const userName = await generateUniqueUsernameFromEmail(userData?.email);
    const sip_domain = agentData?.sip_domain;
    const password = agentData?.sip_password;

    // Create SIP endpoint first (outside transaction for easier cleanup)
    sipInfo = await TwilioSipService.createSipEndpoint({
      userName,
      password,
      sip_domain,
    });

    if (!sipInfo) {
      throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to create SIP endpoint");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Double-check for existing user INSIDE transaction
      const existingUserInTx = await tx.user.findFirst({
        where: { OR: [{ email: userData.email }, { phone: userData.phone }] },
      });

      if (existingUserInTx) {
        throw new ApiError(status.BAD_REQUEST, "User with this email or phone already exists!");
      }


      // Create User
      const userPayload = {
        name: userData.name.trim(),
        bio: userData.bio?.trim() || "",
        email: userData.email.toLowerCase().trim(),
        phone: userData.phone.trim(),
        role: UserRole.agent,
        password: hashedPassword,
        isVerified: true,
      };

      const createdUser = await tx.user.create({ data: userPayload });

      const agentPayload = {
        userId: createdUser.id,
        employeeId: employeeId,
        skills: agentData.skills || [],
        sip_address: sipInfo?.fullSipUri,
        sip_username: userName,
        sip_password: password,
        workStartTime: agentData.workStartTime,
        workEndTime: agentData.workEndTime,
        successCalls: 0,
        droppedCalls: 0,
      };

      const createdAgent = await tx.agent.create({ data: agentPayload });

      // Send welcome email
      const EmailPayload = {
        name: createdUser?.name,
        email: createdUser?.email,
        phone: createdUser?.phone,
        password: userData?.password,
        sip_address: sipInfo?.fullSipUri,
        sip_username: userName,
        sip_password: password,
        employeeId: employeeId,
      };

      await sendAgentWelcomeEmail(createdUser.email, EmailPayload);

      return {
        user: { ...createdUser, password: undefined },
        agent: createdAgent,
      };
    }, { timeout: 10000 });

    return result;

  } catch (error: any) {
    // Cleanup SIP endpoint if agent creation failed
    // if (sipInfo?.credentialListSid) {
    //   await TwilioSipService.deleteSipEndpoint(sipInfo.credentialListSid);
    // }

    console.error("Error creating agent:", error);

    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      const fieldMap: { [key: string]: string } = {
        email: "Email", phone: "Phone", userId: "User ID",
        employeeId: "Employee ID", emergencyPhone: "Emergency Phone", ssn: "SSN"
      };
      const fieldName = fieldMap[field] || field || "Field";
      throw new ApiError(status.BAD_REQUEST, `${fieldName} already exists`);
    }

    if (error instanceof ApiError) throw error;

    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to create agent: " + error.message);
  }
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

  const userData = payload?.userData;
  const agentData = payload?.agentData;
  const image = payload?.image;

  if (!agentId) {
    throw new ApiError(
      status.BAD_REQUEST,
      "targetUserId is required to update agent information"
    );
  }

  // Check if target user exists and is an agent
  const targetUser = await prisma.user.findUnique({
    where: { id: agentId, status: UserStatus.ACTIVE },
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


  const result = await prisma.$transaction(async (transactionClient) => {
    let updatedUser = targetUser;
    let updatedAgent = targetUser?.Agent;

    // console.log("userData", userData);
    // Update user data if provided
    if (userData) {
      // ===== Check for existing user =====
      const existingUser = await transactionClient.user.findFirst({
        where: {
          AND: [
            { id: { not: agentId } }, // exclude current user
            { phone: userData.phone }, // check only phone
          ],
        },
      });

      // console.log("existingUser", existingUser);

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
          image: image || targetUser?.image,
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
          ...agentData,
          skills: agentData.skills
        },
      });
    }

    return { ...updatedUser, password: null };
  });

  return result;
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
    where: { email, status: UserStatus.ACTIVE },
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
    where: { email, status: UserStatus.ACTIVE },
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
    .search(["name", "email", "phone", "ownedOrganization.name"])
    .filter()
    .rawFilter({ status: query?.status, role: query?.role })
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

  // if (!result.length) {
  //   throw new ApiError(status.NOT_FOUND, "No users found!");
  // }

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
  // console.log(payload, 44);
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
  if (payload?.image && isUserExist) {
    // console.log("inside image", payload.image);
    isUserExist.image = payload?.image;
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

const updateAgentSpecificInfo = async (user: User, payload: any) => {
  // Check if user exists and is an agent
  const targetUser = await prisma.user.findUnique({
    where: {
      id: user.id,
      status: UserStatus.ACTIVE,
      role: UserRole.agent, // Ensure the user is an agent
    },
    include: {
      Agent: true,
    },
  });

  if (!targetUser) {
    throw new ApiError(status.NOT_FOUND, "Agent not found!");
  }

  if (!targetUser.Agent) {
    throw new ApiError(
      status.BAD_REQUEST,
      "User is not registered as an agent"
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      image: payload?.image,
      bio: payload?.bio,
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
      status: UserStatus.ACTIVE
    },
    include: {
      Agent: {
        select: {
          id: true,
          userId: true,
          status: true,
          sip_address: true,
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
      ownedOrganization: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { password, ...rest } = user;

  return rest;
};

const updateUserStatusByAdminIntoDB = async (
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

  const { status: UserCurrentStatus } = payload;

  const updatedData: Partial<User> = {};

  if (authUser.role === UserRole.super_admin) {
    updatedData.status = UserCurrentStatus
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
  updateUserStatusByAdminIntoDB,
  forgotPassword,
  resetPassword,
};