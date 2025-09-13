// services/assignment.service.ts
import { PrismaClient, AssignmentStatus, UserRole, User } from "@prisma/client";
import ApiError from "../../errors/AppError";
import status from "http-status";
import {
  IPaginationOptions,
  paginationHelper,
} from "../../utils/paginationHelpers";
import AppError from "../../errors/AppError";
import { createDateFilter, parseAnyDate } from "../../utils/Date/parseAnyDate";

const prisma = new PrismaClient();

// const getAllAgentFromDB = async (
//   options: IPaginationOptions,
//   filters: any = {},
//   user: User
// ) => {
//   const searchTerm = filters?.searchTerm as string;
//   const isAvailable = filters?.isAvailable as boolean | string;
//   const viewType = filters?.viewType as "all" | "my-agents" | "unassigned";

//   if (
//     viewType !== undefined &&
//     viewType !== "all" &&
//     viewType !== "my-agents" &&
//     viewType !== "unassigned"
//   ) {
//     throw new AppError(status.BAD_REQUEST, "Invalid view type!");
//   }

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   let whereClause: any = {
//     isDeleted: false,
//     role: UserRole.agent,
//   };

//   // Handle view type filtering
//   if (user?.role === UserRole.organization_admin && viewType === "my-agents") {
//     const userOrganization = await prisma.organization.findUnique({
//       where: { ownerId: user?.id },
//     });

//     if (!userOrganization) {
//       throw new AppError(
//         status.NOT_FOUND,
//         "Organization not found for this user!"
//       );
//     }

//     whereClause.Agent = {
//       assignTo: userOrganization?.id,
//     };
//   } else if (viewType === "unassigned") {
//     // Unassigned = assignTo is null OR field missing
//     whereClause.Agent = {
//       OR: [
//         { assignTo: null }, // null হলে
//         { assignTo: { isSet: false } }, // field missing হলে (Prisma syntax)
//       ],
//     };
//   }

//   // Search functionality
//   if (searchTerm) {
//     whereClause.OR = [
//       { name: { contains: searchTerm, mode: "insensitive" } },
//       { email: { contains: searchTerm, mode: "insensitive" } },
//       { phone: { contains: searchTerm, mode: "insensitive" } },
//     ];
//   }

//   // Availability filter
//   if (isAvailable !== undefined) {
//     whereClause.Agent = {
//       ...whereClause.Agent,
//       isAvailable: isAvailable === "true" || isAvailable === true,
//     };
//   }

//   const [users, total] = await Promise.all([
//     prisma.user.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         bio: true,
//         image: true,
//         Agent: {
//           select: {
//             AgentFeedbacks: {
//               select: {
//                 id: true,
//                 rating: true,
//               },
//             },

//             skills: true,
//             totalCalls: true,
//             isAvailable: true,
//             status: true,
//             assignTo: true,
//             assignments: {
//               select: {
//                 id: true,
//                 status: true,
//               },
//             },
//             organization: {
//               select: {
//                 id: true,
//                 name: true,
//                 industry: true,
//               },
//             },
//           },
//         },
//       },
//       orderBy: {
//         [sortBy as string]: sortOrder,
//       },
//       skip: Number(skip),
//       take: Number(limit),
//     }),
//     prisma.user.count({
//       where: whereClause,
//     }),
//   ]);

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//     },
//     users,
//   };
// };

const getAllAgentFromDB = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  const searchTerm = filters?.searchTerm as string;
  const isAvailable = filters?.isAvailable as boolean | string;
  const viewType = filters?.viewType as "all" | "my-agents" | "unassigned";

  if (
    viewType !== undefined &&
    viewType !== "all" &&
    viewType !== "my-agents" &&
    viewType !== "unassigned"
  ) {
    throw new AppError(status.BAD_REQUEST, "Invalid view type!");
  }

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  let whereClause: any = {
    isDeleted: false,
    role: UserRole.agent,
  };

  // Handle view type filtering
  if (user?.role === UserRole.organization_admin && viewType === "my-agents") {
    const userOrganization = await prisma.organization.findUnique({
      where: { ownerId: user?.id },
    });

    if (!userOrganization) {
      throw new AppError(
        status.NOT_FOUND,
        "Organization not found for this user!"
      );
    }

    whereClause.Agent = {
      assignTo: userOrganization?.id,
    };
  } else if (viewType === "unassigned") {
    // console.log("unassigned");
    // Unassigned = assignTo is null OR field missing
    whereClause.Agent = {
      OR: [
        { assignTo: null },
        {
          assignTo: {
            isSet: false,
          },
        },
      ],
    };
  }

  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Availability filter
  if (isAvailable !== undefined) {
    whereClause.Agent = {
      ...whereClause.Agent,
      isAvailable: isAvailable === "true" || isAvailable === true,
    };
  }

  // console.log(whereClause);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        image: true,
        Agent: {
          select: {
            AgentFeedbacks: {
              select: {
                id: true,
                rating: true,
              },
            },

            skills: true,
            isAvailable: true,
            status: true,
            assignTo: true,
            assignments: {
              select: {
                id: true,
                status: true,
                agentUserId: true,
                organizationId: true,
                assignedBy: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                industry: true,
              },
            },
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // console.log(users);

  // Calculate average rating for each agent using the fetched feedbacks
  const usersWithAvgRating = users.map((user) => {
    if (user.Agent && user.Agent.AgentFeedbacks) {
      const feedbacks = user.Agent.AgentFeedbacks;
      const totalRating = feedbacks.reduce(
        (sum, feedback) => sum + feedback.rating,
        0
      );
      const avgRating =
        feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

      return {
        ...user,
        Agent: {
          ...user.Agent,
          avgRating: parseFloat(avgRating.toFixed(1)), // Round to 1 decimal place
          totalFeedbacks: feedbacks.length,
        },
      };
    }

    return {
      ...user,
      Agent: {
        ...user.Agent,
        avgRating: 0,
        totalFeedbacks: 0,
      },
    };
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    users: usersWithAvgRating,
  };
};
// const getAllAgentForAdmin = async (
//   options: IPaginationOptions,
//   filters: any = {}
// ) => {
//   const searchTerm = filters?.searchTerm as string;

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   let whereClause: any = {
//     isDeleted: false,
//     role: UserRole.agent,
//   };

//   // Search functionality
//   if (searchTerm) {
//     whereClause.OR = [
//       { name: { contains: searchTerm, mode: "insensitive" } },
//       { email: { contains: searchTerm, mode: "insensitive" } },
//       { phone: { contains: searchTerm, mode: "insensitive" } },
//     ];
//   }

//   const [users, total] = await Promise.all([
//     prisma.user.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         image: true,
//         bio: true,
//         createdAt: true,
//         Agent: {
//           select: {
//             id: true,
//             skills: true,
//             totalCalls: true,
//             successCalls: true,
//             droppedCalls: true,
//             isAvailable: true,
//             status: true,
//             // assignments: {
//             //   select: {
//             //     status: true,
//             //     assignedAt: true,
//             //     organization: {
//             //       select: {
//             //         name: true,
//             //       },
//             //     },
//             //   },
//             //   orderBy: {
//             //     assignedAt: 'desc',
//             //   },
//             //   take: 1,
//             // },
//           },
//         },
//       },
//       orderBy: {
//         [sortBy as string]: sortOrder,
//       },
//       skip: Number(skip),
//       take: Number(limit),
//     }),
//     prisma.user.count({
//       where: whereClause,
//     }),
//   ]);

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//     },
//     data: users,
//   };
// };

const getAllAgentIds = async (user: User) => {
  let agents;

  if (user?.role === UserRole.super_admin) {
    agents = await prisma.agent.findMany({
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  } else if (user?.role === UserRole.organization_admin) {
    const org = await prisma.organization.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });

    if (!org) {
      throw new Error("Organization not found for this admin!");
    }

    agents = await prisma.agent.findMany({
      where: {
        assignments: {
          some: {
            organizationId: org.id,
            status:
              AssignmentStatus.APPROVED || AssignmentStatus.REMOVAL_REQUESTED,
          },
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  return agents;
};

// const getAIAgentIdsByOrganizationAdmin = async (user: User) => {
//   try {
//     // 1. User থেকে organization বের করি
//     const org = await prisma.organization.findFirst({
//       where: {
//         ownerId: user?.id,
//       },
//       select: { id: true, name: true },
//     });

//     console.log("Organization:", org);

//     if (!org) {
//       throw new Error("Organization not found for this user!");
//     }

//     console.log("Organization ID from DB:", org.id);
//     console.log("Organization ID type:", typeof org.id);

//     // // 2. Debug: Check what's actually in the aiAgent collection
//     // const allAIAgents = await prisma.aiAgent.findMany();
//     // console.log("All AI Agents in DB:", allAIAgents);

//     // 3. Try different query approaches

//     // Approach 1: Direct string comparison (most likely to work)
//     const aiAgent = await prisma.aiagent.findFirst({
//       where: {
//         organizationId: org.id, // Try direct comparison
//       },
//     });

//     console.log("AI Agent found (direct comparison):", aiAgent);

//     // Approach 2: If above doesn't work, try with toString()
//     if (!aiAgent) {
//       const aiAgent2 = await prisma.aiagent.findFirst({
//         where: {
//           organizationId: org.id.toString(), // Explicit toString
//         },
//       });
//       console.log("AI Agent found (toString):", aiAgent2);
//     }

//     // Approach 3: Try with the exact string from your data
//     if (!aiAgent) {
//       const aiAgent3 = await prisma.aiagent.findFirst({
//         where: {
//           organizationId: "68c07f6ed7e7d6c718ff8099", // Hardcoded from your data
//         },
//       });
//       console.log("AI Agent found (hardcoded):", aiAgent3);
//     }

//     return {
//       organization: org,
//       aiAgent: aiAgent || null,
//     };

//   } catch (error) {
//     console.error("Error in getAIAgentIdsByOrganizationAdmin:", error);
//     throw error;
//   }
// };

// const getAllAgentIds = async () => {
//   const agents = await prisma.agent.findMany({
//     where: {
//       assignTo: {
//         isSet: false, // means assignTo is not set OR null
//       },
//     },
//     select: {
//       id: true,
//       user: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//   });

//   if (!agents || agents.length === 0) {
//     throw new ApiError(status.NOT_FOUND, "No unassigned agents found!");
//   }

//   return agents;
// };

const getAgentsManagementInfo = async (
  options: IPaginationOptions,
  filters: any = {}
) => {
  const searchTerm = filters?.searchTerm as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  let whereClause: any = {
    isDeleted: false,
    role: UserRole.agent,
  };



  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // console.log(whereClause);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        // "id": "68c307fe072c5a263a704f89",
        //             "userId": "68c307fd072c5a263a704f88",
        //             "status": "offline",
        //             "sip_address": "sip:agentsanim65934@test-uprank.sip.twilio.com",
        //             "sip_username": "agentsanim65934",
        //             "sip_password": "Securepassword123",
        //             "dateOfBirth": "2000-01-01T00:00:00.000Z",
        //             "gender": "male",
        //             "address": "Updated Address Street",
        //             "emergencyPhone": "01743034999",
        //             "ssn": "12347-455-43789",
        //             "skills": [
        //                 "customer service",
        //                 "sales",
        //                 "technical support",
        //                 "communication"
        //             ],
        //             "employeeId": null,
        //             "isAvailable": true,
        //             "assignTo": "68c211cc6864cb0ea1959230",
        //             "jobTitle": "Senior Customer Service Agent",
        //             "employmentType": "full_time",
        //             "department": "Customer Success",
        //             "workEndTime": "17:00:00",
        //             "workStartTime": "09:00:00",
        Agent: true,
        // bio: true,
        // image: true,
        // Agent: true,
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: users,
  };
};
const getSingleAgentInfo = async (
  options: IPaginationOptions,
  filters: any = {}
) => {
  const searchTerm = filters?.searchTerm as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  let whereClause: any = {
    isDeleted: false,
    role: UserRole.agent,
  };



  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // console.log(whereClause);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        // "id": "68c307fe072c5a263a704f89",
        //             "userId": "68c307fd072c5a263a704f88",
        //             "status": "offline",
        //             "sip_address": "sip:agentsanim65934@test-uprank.sip.twilio.com",
        //             "sip_username": "agentsanim65934",
        //             "sip_password": "Securepassword123",
        //             "dateOfBirth": "2000-01-01T00:00:00.000Z",
        //             "gender": "male",
        //             "address": "Updated Address Street",
        //             "emergencyPhone": "01743034999",
        //             "ssn": "12347-455-43789",
        //             "skills": [
        //                 "customer service",
        //                 "sales",
        //                 "technical support",
        //                 "communication"
        //             ],
        //             "employeeId": null,
        //             "isAvailable": true,
        //             "assignTo": "68c211cc6864cb0ea1959230",
        //             "jobTitle": "Senior Customer Service Agent",
        //             "employmentType": "full_time",
        //             "department": "Customer Success",
        //             "workEndTime": "17:00:00",
        //             "workStartTime": "09:00:00",
        Agent: true,
        // bio: true,
        // image: true,
        // Agent: true,
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: users,
  };
};



const getAIAgentIdsByOrganizationAdmin = async (user: User) => {
  try {
    const org = await prisma.organization.findFirst({
      where: {
        ownerId: user?.id,
      },
      select: { id: true, name: true },
    });

    // console.log("Organization:", org);

    if (!org) {
      throw new Error("Organization not found for this user!");
    }

    // 2. Use Prisma query (not raw) since we know the data exists
    const aiAgent = await prisma.aiagents.findFirst({
      where: {
        organizationId: org.id,
      },
      select: {
        agentId: true,
        organizationId: true,
      },
    });

    // console.log("AI Agent found with Prisma:", aiAgent);

    // 3. If Prisma query doesn't work, fall back to raw query
    if (!aiAgent) {
      console.log("Prisma query failed, trying raw MongoDB query...");

      const rawResult = await prisma.$runCommandRaw({
        find: "aiagents",
        filter: {
          organizationId: org.id,
        },
      });

      // console.log("Raw MongoDB result:", rawResult);

      return {
        organization: org,
        aiAgents: rawResult.documents || [],
        source: "raw",
      };
    }

    return {
      aiAgents: aiAgent ? [aiAgent] : [], // Return as array for consistency
    };
  } catch (error) {
    console.error("Error in getAIAgentIdsByOrganizationAdmin:", error);

    // Fallback to raw query if Prisma fails
    try {
      const org = await prisma.organization.findFirst({
        where: {
          ownerId: user?.id,
        },
        select: { id: true, name: true },
      });

      if (org) {
        const rawResult = await prisma.$runCommandRaw({
          find: "aiagents",
          filter: {
            organizationId: org.id,
          },
        });

        return {
          aiAgents: rawResult.documents || [],
        };
      }
    } catch (fallbackError) {
      console.error("Fallback query also failed:", fallbackError);
    }

    throw error;
  }
};
const getAllAgentForAdmin = async (
  options: IPaginationOptions,
  filters: any = {}
) => {
  const searchTerm = filters?.searchTerm as string;
  const assignmentStatus = filters?.viewType as string;
  const isAvailable = filters?.isAvailable as boolean | string;
  const startDate = filters?.startDate as string; // New: start date filter
  const endDate = filters?.endDate as string; // New: end date filter

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  let whereClause: any = {
    isDeleted: false,
    role: UserRole.agent,
  };

  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Date filtering - filter by user creation date
  if (startDate || endDate) {
    const dateFilter = createDateFilter(startDate, endDate, "createdAt");
    whereClause = { ...whereClause, ...dateFilter };
  }

  // Assignment status filter for PENDING or REMOVAL_REQUESTED
  if (assignmentStatus) {
    whereClause.Agent = {
      ...whereClause.Agent,
      assignments: {
        some: {
          status: assignmentStatus,
        },
      },
    };
  }

  // Availability filter
  if (isAvailable !== undefined) {
    whereClause.Agent = {
      ...whereClause.Agent,
      isAvailable: isAvailable === "true" || isAvailable === true,
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        bio: true,
        createdAt: true,
        Agent: {
          select: {
            id: true,
            skills: true,
            successCalls: true,
            droppedCalls: true,
            isAvailable: true,
            status: true,
            AgentFeedbacks: {
              select: {
                id: true,
                rating: true,
              },
            },
            assignTo: true,
            assignments: {
              select: {
                id: true,
                organization: {
                  select: {
                    id: true,
                    name: true
                  },
                },
                agentUserId: true,
                status: true,
                assignedBy: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                industry: true,
              },
            },
            // assignments: {
            //   select: {
            //     id: true,
            //     status: true,
            //     assignedAt: true,
            //     organization: {
            //       select: {
            //         id: true,
            //         name: true,
            //         industry: true,
            //       },
            //     },
            //   },
            //   orderBy: {
            //     assignedAt: "desc",
            //   },
            // },
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Calculate average rating for each agent using the fetched feedbacks
  const usersWithAvgRating = users.map((user) => {
    // Safe access to nested properties with optional chaining and fallbacks
    const agent = user?.Agent;
    const feedbacks = agent?.AgentFeedbacks || [];

    // Calculate average rating
    const totalRating = feedbacks.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    // Get the latest assignment

    return {
      ...user,
      Agent: {
        id: agent?.id || null,
        skills: agent?.skills || [],
        successCalls: agent?.successCalls || 0,
        droppedCalls: agent?.droppedCalls || 0,
        isAvailable: agent?.isAvailable ?? false,
        status: agent?.status || null,
        AgentFeedbacks: feedbacks,
        organization: agent?.organization || null,
        assignments: agent?.assignments || [],
        assignTo: agent?.assignTo || null,

        avgRating: parseFloat(avgRating.toFixed(1)),
        totalFeedbacks: feedbacks.length,
      },
    };
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: usersWithAvgRating,
  };
};
// Request assignment (Organization Admin)
const requestAgentAssignment = async (agentUserId: string, user: User) => {
  // Use transaction for data consistency
  return await prisma.$transaction(async (tx) => {
    // 1. Validate agent exists
    const agent = await tx.agent.findUnique({
      where: { userId: agentUserId },
      include: { user: true },
    });

    if (!agent) {
      throw new ApiError(status.NOT_FOUND, "Agent not found!");
    }

    // 2. Validate organization exists and user owns it
    const organization = await tx.organization.findUnique({
      where: { ownerId: user.id },
    });

    if (!organization) {
      throw new ApiError(status.NOT_FOUND, "Organization not found!");
    }

    // 3. Check if agent has active assignments in other organizations
    const activeOtherAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: { not: organization.id },
        status: {
          in: [
            AssignmentStatus.PENDING,
            AssignmentStatus.APPROVED,
            AssignmentStatus.REMOVAL_REQUESTED,
          ],
        },
      },
    });

    if (activeOtherAssignment) {
      const errorMessages: any = {
        [AssignmentStatus.PENDING]:
          "⚠️ Agent has a pending request in another organization!",
        [AssignmentStatus.APPROVED]:
          "✅ Agent is already working in another organization!",
        [AssignmentStatus.REMOVAL_REQUESTED]:
          "🔄 Agent has a removal request pending in another organization!",
      };

      throw new ApiError(
        status.BAD_REQUEST,
        errorMessages[activeOtherAssignment.status] ||
          `Cannot assign agent: ${activeOtherAssignment.status} in another organization`
      );
    }

    // 4. Check for existing assignment for this organization
    const existingAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: organization.id,
        status: {
          in: [
            AssignmentStatus.PENDING,
            AssignmentStatus.APPROVED,
            AssignmentStatus.REMOVAL_REQUESTED,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingAssignment) {
      const errorMessages: any = {
        [AssignmentStatus.PENDING]: "⚠️ Assignment request is already pending!",
        [AssignmentStatus.APPROVED]:
          "✅ Agent is already assigned to your organization!",
        [AssignmentStatus.REMOVAL_REQUESTED]:
          "⚠️ Agent removal is already requested. Please wait for admin approval.",
      };

      throw new ApiError(
        status.BAD_REQUEST,
        errorMessages[existingAssignment.status] ||
          `Existing assignment with status: ${existingAssignment.status}`
      );
    }

    // 5. Create assignment request
    const assignment = await tx.agentAssignment.create({
      data: {
        agentUserId: agentUserId,
        organizationId: organization.id,
        assignedBy: user.id,
        status: AssignmentStatus.PENDING,
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return assignment;
  });
};

// Approve assignment (Admin only) - Find by agentUserId and organizationId
const approveAssignment = async (
  agentUserId: string,
  organizationId: string
) => {
  return await prisma.$transaction(async (tx) => {
    // Find the assignment by agentUserId and organizationId
    const assignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: organizationId,
        status: AssignmentStatus.PENDING,
      },
      include: { agent: true },
    });

    if (!assignment) {
      throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
    }

    // if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
    //   throw new ApiError(
    //     status.BAD_REQUEST,
    //     "Assignment request is not in removal requested status!"
    //   );
    // }

    // Check if agent already has an active assignment in other organizations
    const activeAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        status: AssignmentStatus.APPROVED,
        organizationId: { not: organizationId }, // Check other organizations
      },
    });

    if (activeAssignment) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Agent already has an active assignment to another organization!"
      );
    }

    // Update the assignment status to APPROVED using the assignment ID
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id }, // Use the found assignment's ID
      data: {
        status: AssignmentStatus.APPROVED,
        approvedAt: new Date(),
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update the agent's assignTo field
    await tx.agent.update({
      where: { userId: agentUserId },
      data: {
        assignTo: organizationId,
        isAvailable: true,
      },
    });

    return updatedAssignment;
  });
};

// Reject assignment (Admin only)
const rejectAssignment = async (
  userId: string,
  organizationId: string,
  reason?: string
) => {
  return await prisma.$transaction(async (tx) => {
    // Find the assignment by userId (agentUserId) and organizationId
    const assignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: userId,
        organizationId: organizationId,
        status: AssignmentStatus.PENDING,
      },
      include: {
        agent: true,
      },
    });

    if (!assignment) {
      throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
    }

    // if (assignment.status !== AssignmentStatus.PENDING) {
    //   throw new ApiError(
    //     status.BAD_REQUEST,
    //     `Cannot reject assignment with status: ${assignment.status}. Only PENDING assignments can be rejected.`
    //   );
    // }

    // Update the assignment status to REJECTED using the found assignment's ID
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.REJECTED,
        rejectedAt: new Date(),
        reason: reason,
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Only remove organization assignment if this was the current one
    if (assignment.agent.assignTo === assignment.organizationId) {
      await tx.agent.update({
        where: { userId: assignment.agentUserId },
        data: {
          assignTo: null,
          isAvailable: true,
        },
      });
    }

    return updatedAssignment;
  });
};

// Organization admin requests agent removal to super admin
const requestAgentRemoval = async (agentUserId: string, user: User) => {
  // Validate input
  if (!agentUserId || !user?.id) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Agent user ID and user information are required!"
    );
  }

  return await prisma.$transaction(async (tx) => {
    // Validate agent exists
    const agent = await tx.agent.findUnique({
      where: { userId: agentUserId },
      include: { user: true },
    });

    if (!agent) {
      throw new ApiError(status.NOT_FOUND, "Agent not found!");
    }

    // Validate organization exists and user owns it
    const organization = await tx.organization.findUnique({
      where: { ownerId: user.id },
    });

    if (!organization) {
      throw new ApiError(status.NOT_FOUND, "Organization not found!");
    }

    // Check if agent is actually assigned to this organization
    if (agent.assignTo !== organization.id) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Agent is not assigned to your organization!"
      );
    }

    // Find the existing approved assignment
    const existingAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: organization.id,
        status: AssignmentStatus.APPROVED,
      },
    });

    if (!existingAssignment) {
      throw new ApiError(
        status.BAD_REQUEST,
        "No approved assignment found for this agent!"
      );
    }

    // Update assignment status to REMOVAL_REQUESTED
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        status: AssignmentStatus.REMOVAL_REQUESTED,
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedAssignment;
  });
};

// Super admin approves removal request
const approveAgentRemoval = async (userId: string, organizationId: string) => {
  return await prisma.$transaction(async (tx) => {
    // Find the removal request by userId (agentUserId) and organizationId
    const assignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: userId,
        organizationId: organizationId,
        status: AssignmentStatus.REMOVAL_REQUESTED,
      },
      include: {
        agent: true,
      },
    });

    if (!assignment) {
      throw new ApiError(status.NOT_FOUND, "Removal request not found!");
    }

    if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Assignment is not in removal requested status!"
      );
    }

    // Update assignment status to REJECTED (final removal)
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.REJECTED,
        rejectedAt: new Date(),
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Remove agent from organization
    await tx.agent.update({
      where: { userId: assignment.agentUserId },
      data: {
        assignTo: null,
        isAvailable: true,
      },
    });

    return updatedAssignment;
  });
};

// Super admin rejects removal request
const rejectAgentRemoval = async (
  userId: string,
  organizationId: string,
  reason?: string
) => {
  return await prisma.$transaction(async (tx) => {
    // Find the removal request by userId (agentUserId) and organizationId
    const assignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: userId,
        organizationId: organizationId,
        status: AssignmentStatus.REMOVAL_REQUESTED,
      },
      include: {
        agent: true,
      },
    });

    if (!assignment) {
      throw new ApiError(status.NOT_FOUND, "Removal request not found!");
    }

    if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Assignment is not in removal requested status!"
      );
    }

    // Revert back to APPROVED status
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.APPROVED,
        rejectedAt: null,
        reason:
          reason ||
          "Removal request rejected by admin. Please contact super admin.",
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: true,
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedAssignment;
  });
};

// Get all removal requests for super admin
const getApprovalRemovalRequestsForSuperAdmin = async (
  options: IPaginationOptions,
  filters: any = {}
) => {
  const searchTerm = filters?.searchTerm as string;
  const statusFilter = filters?.status as AssignmentStatus;
  const organizationName = filters?.organizationName as string;
  const agentName = filters?.agentName as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  let whereClause: any = {
    // status: AssignmentStatus.REMOVAL_REQUESTED,
  };

  // Status filter
  if (statusFilter && Object.values(AssignmentStatus).includes(statusFilter)) {
    whereClause.status = statusFilter;
  }

  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      {
        agent: {
          user: {
            name: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
      {
        agent: {
          user: {
            email: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
      {
        agent: {
          user: {
            phone: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
      {
        organization: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
      {
        reason: { contains: searchTerm, mode: "insensitive" },
      },
    ];
  }

  // Organization name filter
  if (organizationName) {
    whereClause.organization = {
      name: { contains: organizationName, mode: "insensitive" },
    };
  }

  // Agent name filter
  if (agentName) {
    whereClause.agent = {
      user: {
        name: { contains: agentName, mode: "insensitive" },
      },
    };
  }

  const [removalRequests, total] = await Promise.all([
    prisma.agentAssignment.findMany({
      where: whereClause,
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                bio: true,
                role: true,
                status: true,
              },
            },
            AgentFeedbacks: {
              select: {
                id: true,
                rating: true,
              },
            },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            industry: true,
            address: true,
            websiteLink: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.agentAssignment.count({
      where: whereClause,
    }),
  ]);

  // Transform to match getAllAgentFromDB structure with average rating
  const formattedData = removalRequests?.map((request) => {
    // Calculate average rating for the agent
    const feedbacks = request.agent.AgentFeedbacks || [];
    const totalRating = feedbacks.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    // Main user data structure (same as getAllAgentFromDB)
    const userData = {
      id: request.agent.user.id,
      name: request.agent.user.name,
      email: request.agent.user.email,
      phone: request.agent.user.phone,
      bio: request.agent.user.bio,
      image: request.agent.user.image,
      role: request.agent.user.role,
      status: request.agent.user.status,

      // Agent-specific data (matching your Agent model structure)
      Agent: {
        id: request.agent.id,
        skills: request.agent.skills || [],
        isAvailable: request.agent.isAvailable,
        status: request.agent.status,
        assignTo: request.agent.assignTo,

        // Organization data
        organization: request.organization
          ? {
              id: request.organization.id,
              name: request.organization.name,
              industry: request.organization.industry,
              address: request.organization.address,
              websiteLink: request.organization.websiteLink,
            }
          : null,

        // Assignments data
        assignments: [
          {
            id: request.id,
            status: request.status,
            assignedAt: request.assignedAt,
            approvedAt: request.approvedAt,
            rejectedAt: request.rejectedAt,
            reason: request.reason,
            organizationId: request.organizationId,
          },
        ],

        // AgentFeedbacks with average rating
        AgentFeedbacks: feedbacks,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalFeedbacks: feedbacks.length,
      },
    };

    return userData;
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    users: formattedData, // Using 'users' key to match getAllAgentFromDB
  };
};

// Get pending assignments (Admin only)
const getPendingAssignments = async () => {
  const pendingAssignments = await prisma.agentAssignment.findMany({
    where: {
      status: AssignmentStatus.PENDING,
    },
    include: {
      agent: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      organization: {
        include: {
          ownedOrganization: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      assignedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  return pendingAssignments;
};

// Get assignment status for an agent
const getAgentAssignmentStatus = async (agentUserId: string) => {
  const assignments = await prisma.agentAssignment.findMany({
    where: {
      agentUserId: agentUserId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  const agent = await prisma.agent.findUnique({
    where: { userId: agentUserId },
    select: {
      assignTo: true,
      isAvailable: true,
    },
  });

  if (!agent) {
    throw new ApiError(status.NOT_FOUND, "Agent not found!");
  }

  return {
    currentOrganization: agent.assignTo,
    isAvailable: agent.isAvailable,
    assignmentHistory: assignments,
  };
};

// Get assignments for an organization
const getOrganizationAssignments = async (organizationId: string) => {
  const assignments = await prisma.agentAssignment.findMany({
    where: {
      organizationId: organizationId,
    },
    include: {
      agent: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      assignedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  return assignments;
};

export const AssignmentService = {
  requestAgentAssignment,
  getAgentsManagementInfo,
  approveAgentRemoval,
  getAIAgentIdsByOrganizationAdmin,
  rejectAgentRemoval,
  getAllAgentFromDB,
  requestAgentRemoval,
  getAllAgentIds,
  getApprovalRemovalRequestsForSuperAdmin,
  getAllAgentForAdmin,
  approveAssignment,
  rejectAssignment,
  getPendingAssignments,
  getAgentAssignmentStatus,
  getOrganizationAssignments,
};

// import { PrismaClient, AssignmentStatus, UserRole, User } from "@prisma/client";
// import ApiError from "../../errors/AppError";
// import status from "http-status";
// import {
//   IPaginationOptions,
//   paginationHelper,
// } from "../../utils/paginationHelpers";
// import AppError from "../../errors/AppError";
// import { createDateFilter } from "../../utils/Date/parseAnyDate";

// const prisma = new PrismaClient();

// const getAllAgentFromDB = async (
//   options: IPaginationOptions,
//   filters: any = {},
//   user: User
// ) => {
//   const searchTerm = filters?.searchTerm as string;
//   const isAvailable = filters?.isAvailable as boolean | string;
//   const viewType = filters?.viewType as "all" | "my-agents" | "unassigned";

//   if (
//     viewType !== undefined &&
//     viewType !== "all" &&
//     viewType !== "my-agents" &&
//     viewType !== "unassigned"
//   ) {
//     throw new AppError(status.BAD_REQUEST, "Invalid view type!");
//   }

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   let whereClause: any = {
//     isDeleted: false,
//     role: UserRole.agent,
//   };

//   // Handle view type filtering
//   if (user?.role === UserRole.organization_admin && viewType === "my-agents") {
//     const userOrganization = await prisma.organization.findUnique({
//       where: { ownerId: user?.id },
//     });

//     if (!userOrganization) {
//       throw new AppError(
//         status.NOT_FOUND,
//         "Organization not found for this user!"
//       );
//     }

//     whereClause.Agent = {
//       assignTo: userOrganization?.id,
//     };
//   } else if (viewType === "unassigned") {
//     // Unassigned = assignTo is null OR field missing
//     whereClause.Agent = {
//       OR: [{ assignTo: null }, { assignTo: { isSet: false } }],
//     };
//   }

//   // Search functionality
//   if (searchTerm) {
//     whereClause.OR = [
//       { name: { contains: searchTerm, mode: "insensitive" } },
//       { email: { contains: searchTerm, mode: "insensitive" } },
//       { phone: { contains: searchTerm, mode: "insensitive" } },
//     ];
//   }

//   // Availability filter
//   if (isAvailable !== undefined) {
//     whereClause.Agent = {
//       ...whereClause.Agent,
//       isAvailable: isAvailable === "true" || isAvailable === true,
//     };
//   }

//   const [users, total] = await Promise.all([
//     prisma.user.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         bio: true,
//         image: true,
//         Agent: {
//           select: {
//             AgentFeedbacks: {
//               select: {
//                 id: true,
//                 rating: true,
//               },
//             },
//             skills: true,
//             totalCalls: true,
//             isAvailable: true,
//             status: true,
//             assignTo: true,
//             assignments: {
//               where: {
//                 status: AssignmentStatus.APPROVED, // Only show approved assignments
//               },
//               select: {
//                 id: true,
//                 status: true,
//               },
//               take: 1, // Only get the current active assignment
//             },
//             organization: {
//               select: {
//                 id: true,
//                 name: true,
//                 industry: true,
//               },
//             },
//           },
//         },
//       },
//       orderBy: {
//         [sortBy as string]: sortOrder,
//       },
//       skip: Number(skip),
//       take: Number(limit),
//     }),
//     prisma.user.count({
//       where: whereClause,
//     }),
//   ]);

//   // Calculate average rating for each agent using the fetched feedbacks
//   const usersWithAvgRating = users.map((user) => {
//     if (user.Agent && user.Agent.AgentFeedbacks) {
//       const feedbacks = user.Agent.AgentFeedbacks;
//       const totalRating = feedbacks.reduce(
//         (sum, feedback) => sum + feedback.rating,
//         0
//       );
//       const avgRating =
//         feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

//       return {
//         ...user,
//         Agent: {
//           ...user.Agent,
//           avgRating: parseFloat(avgRating.toFixed(1)), // Round to 1 decimal place
//           totalFeedbacks: feedbacks.length,
//         },
//       };
//     }

//     return {
//       ...user,
//       Agent: {
//         ...user.Agent,
//         avgRating: 0,
//         totalFeedbacks: 0,
//       },
//     };
//   });

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//     },
//     users: usersWithAvgRating,
//   };
// };

// const getAllAgentForAdmin = async (
//   options: IPaginationOptions,
//   filters: any = {}
// ) => {
//   const searchTerm = filters?.searchTerm as string;
//   const assignmentStatus = filters?.viewType as string;
//   const isAvailable = filters?.isAvailable as boolean | string;
//   const startDate = filters?.startDate as string;
//   const endDate = filters?.endDate as string;

//   console.log(filters);
//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   let whereClause: any = {
//     isDeleted: false,
//     role: UserRole.agent,
//   };

//   // Search functionality
//   if (searchTerm) {
//     whereClause.OR = [
//       { name: { contains: searchTerm, mode: "insensitive" } },
//       { email: { contains: searchTerm, mode: "insensitive" } },
//       { phone: { contains: searchTerm, mode: "insensitive" } },
//     ];
//   }

//   // Date filtering - filter by user creation date
//   if (startDate || endDate) {
//     const dateFilter = createDateFilter(startDate, endDate, "createdAt");
//     whereClause = { ...whereClause, ...dateFilter };
//   }

//   // Assignment status filter for PENDING or REMOVAL_REQUESTED
//   if (assignmentStatus) {
//     whereClause.Agent = {
//       ...whereClause.Agent,
//       assignments: {
//         some: {
//           status: assignmentStatus,
//         },
//       },
//     };
//   }

//   // Availability filter
//   if (isAvailable !== undefined) {
//     whereClause.Agent = {
//       ...whereClause.Agent,
//       isAvailable: isAvailable === "true" || isAvailable === true,
//     };
//   }

//   const [users, total] = await Promise.all([
//     prisma.user.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         image: true,
//         bio: true,
//         createdAt: true,
//         Agent: {
//           select: {
//             id: true,
//             skills: true,
//             totalCalls: true,
//             successCalls: true,
//             droppedCalls: true,
//             isAvailable: true,
//             status: true,
//             AgentFeedbacks: {
//               select: {
//                 id: true,
//                 rating: true,
//               },
//             },
//             assignments: {
//               where: {
//                 status: AssignmentStatus.APPROVED, // Only show approved assignments
//               },
//               select: {
//                 id: true,
//                 status: true,
//                 assignedAt: true,
//                 organization: {
//                   select: {
//                     id: true,
//                     name: true,
//                     industry: true,
//                   },
//                 },
//               },
//               orderBy: {
//                 assignedAt: "desc",
//               },
//               take: 1, // Only get the most recent approved assignment
//             },
//           },
//         },
//       },
//       orderBy: {
//         [sortBy as string]: sortOrder,
//       },
//       skip: Number(skip),
//       take: Number(limit),
//     }),
//     prisma.user.count({
//       where: whereClause,
//     }),
//   ]);

//   // Calculate average rating for each agent using the fetched feedbacks
//   const usersWithAvgRating = users.map((user) => {
//     const agent = user.Agent;
//     const feedbacks = agent?.AgentFeedbacks || [];
//     const assignments = agent?.assignments || [];

//     // Calculate average rating
//     const totalRating = feedbacks.reduce(
//       (sum, feedback) => sum + feedback.rating,
//       0
//     );
//     const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

//     // Get the latest assignment
//     const latestAssignment = assignments.length > 0 ? assignments[0] : null;

//     return {
//       ...user,
//       Agent: {
//         id: agent?.id || null,
//         skills: agent?.skills || [],
//         totalCalls: agent?.totalCalls || 0,
//         successCalls: agent?.successCalls || 0,
//         droppedCalls: agent?.droppedCalls || 0,
//         isAvailable: agent?.isAvailable ?? false,
//         status: agent?.status || null,
//         AgentFeedbacks: feedbacks,
//         assignments: assignments,
//         avgRating: parseFloat(avgRating.toFixed(1)),
//         totalFeedbacks: feedbacks.length,
//         latestAssignment: latestAssignment,
//       },
//     };
//   });

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//     },
//     data: usersWithAvgRating,
//   };
// };

// // Request assignment (Organization Admin)
// const requestAgentAssignment = async (agentUserId: string, user: User) => {
//   // Validate agent exists
//   const agent = await prisma.agent.findUnique({
//     where: { userId: agentUserId },
//     include: { user: true },
//   });

//   if (!agent) {
//     throw new ApiError(status.NOT_FOUND, "Agent not found!");
//   }

//   // Check if agent already has an active assignment
//   const activeAssignment = await prisma.agentAssignment.findFirst({
//     where: {
//       agentUserId: agentUserId,
//       status: AssignmentStatus.APPROVED,
//     },
//   });

//   if (activeAssignment) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Agent already has an active assignment to another organization!"
//     );
//   }

//   // Validate organization exists and user owns it
//   const organization = await prisma.organization.findUnique({
//     where: { ownerId: user.id },
//   });

//   if (!organization) {
//     throw new ApiError(status.NOT_FOUND, "Organization not found!");
//   }

//   // Check if agent already has a pending or approved assignment to this organization
//   const existingAssignment = await prisma.agentAssignment.findFirst({
//     where: {
//       agentUserId: agentUserId,
//       organizationId: organization.id,
//       status: { in: [AssignmentStatus.PENDING, AssignmentStatus.APPROVED] },
//     },
//   });

//   if (existingAssignment) {
//     if (existingAssignment.status === "APPROVED") {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Agent is already assigned to your organization!"
//       );
//     }
//     if (existingAssignment.status === "PENDING") {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Assignment request already pending!"
//       );
//     }
//   }

//   // Create assignment request
//   const assignment = await prisma.agentAssignment.create({
//     data: {
//       agentUserId: agentUserId,
//       organizationId: organization.id,
//       assignedBy: user.id,
//       status: AssignmentStatus.PENDING,
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//   });

//   return {
//     ...assignment,
//     message: "Assignment request submitted. Waiting for admin approval.",
//   };
// };

// // Approve assignment (Admin only)
// const approveAssignment = async (assignmentId: string) => {
//   const assignment = await prisma.agentAssignment.findUnique({
//     where: { id: assignmentId },
//     include: { agent: true },
//   });

//   if (!assignment) {
//     throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
//   }

//   if (assignment.status !== AssignmentStatus.PENDING) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Assignment is not in pending status!"
//     );
//   }

//   // Check if agent already has an active assignment
//   const activeAssignment = await prisma.agentAssignment.findFirst({
//     where: {
//       agentUserId: assignment.agentUserId,
//       status: AssignmentStatus.APPROVED,
//       id: { not: assignmentId },
//     },
//   });

//   if (activeAssignment) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Agent already has an active assignment to another organization!"
//     );
//   }

//   // Update the assignment status to APPROVED
//   const updatedAssignment = await prisma.agentAssignment.update({
//     where: { id: assignmentId },
//     data: {
//       status: AssignmentStatus.APPROVED,
//       approvedAt: new Date(),
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//     },
//   });

//   // Also update the agent's assignTo field
//   await prisma.agent.update({
//     where: { userId: assignment.agentUserId },
//     data: {
//       assignTo: assignment?.organizationId,
//       isAvailable: true,
//     },
//   });

//   return {
//     ...updatedAssignment,
//     message: "Agent assignment approved successfully!",
//   };
// };

// // Reject assignment (Admin only)
// const rejectAssignment = async (assignmentId: string) => {
//   const assignment = await prisma.agentAssignment.findUnique({
//     where: { id: assignmentId },
//     include: {
//       agent: true,
//       organization: true,
//     },
//   });

//   if (!assignment) {
//     throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
//   }

//   if (assignment.status !== AssignmentStatus.PENDING) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Assignment is not in pending status!"
//     );
//   }

//   // Update the assignment status to REJECTED
//   const updatedAssignment = await prisma.agentAssignment.update({
//     where: { id: assignmentId },
//     data: {
//       status: AssignmentStatus.REJECTED,
//       rejectedAt: new Date(),
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//   });

//   // For rejection: Only remove organization assignment if this was the current one
//   if (assignment.agent.assignTo === assignment.organizationId) {
//     await prisma.agent.update({
//       where: { userId: assignment.agentUserId },
//       data: {
//         assignTo: null,
//         isAvailable: true,
//       },
//     });
//   }

//   return updatedAssignment;
// };

// // Get pending assignments (Admin only)
// const getPendingAssignments = async () => {
//   const pendingAssignments = await prisma.agentAssignment.findMany({
//     where: {
//       status: AssignmentStatus.PENDING,
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//               phone: true,
//             },
//           },
//         },
//       },
//       organization: {
//         include: {
//           ownedOrganization: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//     orderBy: {
//       assignedAt: "desc",
//     },
//   });

//   return pendingAssignments;
// };

// // Get assignment status for an agent
// const getAgentAssignmentStatus = async (agentUserId: string) => {
//   const assignments = await prisma.agentAssignment.findMany({
//     where: {
//       agentUserId: agentUserId,
//     },
//     include: {
//       organization: {
//         select: {
//           id: true,
//           name: true,
//         },
//       },
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//     orderBy: {
//       assignedAt: "desc",
//     },
//   });

//   const agent = await prisma.agent.findUnique({
//     where: { userId: agentUserId },
//     select: {
//       assignTo: true,
//       isAvailable: true,
//     },
//   });

//   if (!agent) {
//     throw new ApiError(status.NOT_FOUND, "Agent not found!");
//   }

//   return {
//     currentOrganization: agent.assignTo,
//     isAvailable: agent.isAvailable,
//     assignmentHistory: assignments,
//   };
// };

// // Get assignments for an organization
// const getOrganizationAssignments = async (organizationId: string) => {
//   const assignments = await prisma.agentAssignment.findMany({
//     where: {
//       organizationId: organizationId,
//       status: AssignmentStatus.APPROVED, // Only show approved assignments
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//               phone: true,
//             },
//           },
//         },
//       },
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//     orderBy: {
//       assignedAt: "desc",
//     },
//   });

//   return assignments;
// };

// const getAllagentUserIds = async () => {
//   const agents = await prisma.agent.findMany({
//     where: {
//       assignTo: {
//         isSet: false,   // means assignTo is not set OR null
//       },
//     },
//     select: {
//       id: true,
//       user: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//   });

//   if (!agents || agents.length === 0) {
//     throw new ApiError(status.NOT_FOUND, "No unassigned agents found!");
//   }

//   return agents;
// };

// // Organization admin requests agent removal to super admin
// const requestAgentRemoval = async (agentUserId: string, user: User) => {
//   // Validate agent exists
//   const agent = await prisma.agent.findUnique({
//     where: { userId: agentUserId },
//     include: {
//       user: true,
//     },
//   });

//   if (!agent) {
//     throw new ApiError(status.NOT_FOUND, "Agent not found!");
//   }

//   // Validate organization exists and user owns it
//   const organization = await prisma.organization.findUnique({
//     where: { ownerId: user.id },
//   });

//   if (!organization) {
//     throw new ApiError(status.NOT_FOUND, "Organization not found!");
//   }

//   // Check if agent is actually assigned to this organization
//   if (agent.assignTo !== organization.id) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Agent is not assigned to your organization!"
//     );
//   }

//   // Find the existing approved assignment
//   const existingAssignment = await prisma.agentAssignment.findFirst({
//     where: {
//       agentUserId: agentUserId,
//       organizationId: organization.id,
//       status: AssignmentStatus.APPROVED,
//     },
//   });

//   if (!existingAssignment) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "No approved assignment found for this agent!"
//     );
//   }

//   // Update assignment status to REMOVAL_REQUESTED
//   const updatedAssignment = await prisma.agentAssignment.update({
//     where: { id: existingAssignment.id },
//     data: {
//       status: AssignmentStatus.REMOVAL_REQUESTED,
//       rejectedAt: new Date(),
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//       assignedByUser: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//         },
//       },
//     },
//   });

//   return updatedAssignment;
// };

// // Super admin approves removal request
// const approveAgentRemoval = async (assignmentId: string) => {
//   const assignment = await prisma.agentAssignment.findUnique({
//     where: { id: assignmentId },
//     include: {
//       agent: true,
//       organization: true,
//     },
//   });

//   if (!assignment) {
//     throw new ApiError(status.NOT_FOUND, "Assignment not found!");
//   }

//   if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Assignment is not in removal requested status!"
//     );
//   }

//   // Update assignment status to REJECTED (final removal)
//   const updatedAssignment = await prisma.agentAssignment.update({
//     where: { id: assignmentId },
//     data: {
//       status: AssignmentStatus.REJECTED,
//       rejectedAt: new Date(),
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//     },
//   });

//   // Remove agent from organization
//   await prisma.agent.update({
//     where: { userId: assignment.agentUserId },
//     data: {
//       assignTo: null,
//       isAvailable: true,
//     },
//   });

//   return updatedAssignment;
// };

// // Super admin rejects removal request
// const rejectAgentRemoval = async (assignmentId: string, reason?: string) => {
//   const assignment = await prisma.agentAssignment.findUnique({
//     where: { id: assignmentId },
//     include: {
//       agent: true,
//       organization: true,
//     },
//   });

//   if (!assignment) {
//     throw new ApiError(status.NOT_FOUND, "Assignment not found!");
//   }

//   if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Assignment is not in removal requested status!"
//     );
//   }

//   // Revert back to APPROVED status
//   const updatedAssignment = await prisma.agentAssignment.update({
//     where: { id: assignmentId },
//     data: {
//       status: AssignmentStatus.APPROVED,
//       rejectedAt: null,
//       reason: reason || "Removal request rejected by super admin",
//     },
//     include: {
//       agent: {
//         include: {
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//       organization: true,
//     },
//   });

//   return updatedAssignment;
// };

// // Get all removal requests for super admin
// const getApprovalRemovalRequestsForSuperAdmin = async (
//   options: IPaginationOptions,
//   filters: any = {}
// ) => {
//   const searchTerm = filters?.searchTerm as string;
//   const statusFilter = filters?.status as AssignmentStatus;
//   const organizationName = filters?.organizationName as string;
//   const agentName = filters?.agentName as string;

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   let whereClause: any = {};

//   // Status filter
//   if (statusFilter && Object.values(AssignmentStatus).includes(statusFilter)) {
//     whereClause.status = statusFilter;
//   }

//   // Search functionality
//   if (searchTerm) {
//     whereClause.OR = [
//       {
//         agent: {
//           user: {
//             name: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//       {
//         agent: {
//           user: {
//             email: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//       {
//         agent: {
//           user: {
//             phone: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//       {
//         organization: {
//           name: { contains: searchTerm, mode: "insensitive" },
//         },
//       },
//       {
//         reason: { contains: searchTerm, mode: "insensitive" },
//       },
//     ];
//   }

//   // Organization name filter
//   if (organizationName) {
//     whereClause.organization = {
//       name: { contains: organizationName, mode: "insensitive" },
//     };
//   }

//   // Agent name filter
//   if (agentName) {
//     whereClause.agent = {
//       user: {
//         name: { contains: agentName, mode: "insensitive" },
//       },
//     };
//   }

//   const [removalRequests, total] = await Promise.all([
//     prisma.agentAssignment.findMany({
//       where: whereClause,
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//                 phone: true,
//                 image: true,
//                 bio: true,
//                 role: true,
//                 status: true,
//               },
//             },
//             AgentFeedbacks: {
//               select: {
//                 id: true,
//                 rating: true,
//               },
//             },
//           },
//         },
//         organization: {
//           select: {
//             id: true,
//             name: true,
//             industry: true,
//             address: true,
//             websiteLink: true,
//           },
//         },
//       },
//       orderBy: {
//         [sortBy as string]: sortOrder,
//       },
//       skip: Number(skip),
//       take: Number(limit),
//     }),
//     prisma.agentAssignment.count({
//       where: whereClause,
//     }),
//   ]);

//   // Transform to match getAllAgentFromDB structure with average rating
//   const formattedData = removalRequests?.map((request) => {
//     const feedbacks = request.agent.AgentFeedbacks || [];
//     const totalRating = feedbacks.reduce(
//       (sum, feedback) => sum + feedback.rating,
//       0
//     );
//     const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

//     const userData = {
//       id: request.agent.user.id,
//       name: request.agent.user.name,
//       email: request.agent.user.email,
//       phone: request.agent.user.phone,
//       bio: request.agent.user.bio,
//       image: request.agent.user.image,
//       role: request.agent.user.role,
//       status: request.agent.user.status,

//       Agent: {
//         id: request.agent.id,
//         skills: request.agent.skills || [],
//         totalCalls: request.agent.totalCalls || 0,
//         isAvailable: request.agent.isAvailable,
//         status: request.agent.status,
//         assignTo: request.agent.assignTo,

//         organization: request.organization
//           ? {
//               id: request.organization.id,
//               name: request.organization.name,
//               industry: request.organization.industry,
//               address: request.organization.address,
//               websiteLink: request.organization.websiteLink,
//             }
//           : null,

//         assignments: [
//           {
//             id: request.id,
//             status: request.status,
//             assignedAt: request.assignedAt,
//             approvedAt: request.approvedAt,
//             rejectedAt: request.rejectedAt,
//             reason: request.reason,
//             organizationId: request.organizationId,
//           },
//         ],

//         AgentFeedbacks: feedbacks,
//         avgRating: parseFloat(avgRating.toFixed(1)),
//         totalFeedbacks: feedbacks.length,
//       },
//     };

//     return userData;
//   });

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//     },
//     users: formattedData,
//   };
// };

// export const AssignmentService = {
//   requestAgentAssignment,
//   approveAgentRemoval,
//   rejectAgentRemoval,
//   getAllAgentFromDB,
//   requestAgentRemoval,
//   getAllagentUserIds,
//   getApprovalRemovalRequestsForSuperAdmin,
//   getAllAgentForAdmin,
//   approveAssignment,
//   rejectAssignment,
//   getPendingAssignments,
//   getAgentAssignmentStatus,
//   getOrganizationAssignments,
// };
