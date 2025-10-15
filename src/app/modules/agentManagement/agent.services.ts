// services/assignment.service.ts
import {
  AssignmentStatus,
  UserRole,
  User,
  SubscriptionStatus,
  agentPrivacy,
} from "@prisma/client";
import ApiError from "../../errors/AppError";
import status from "http-status";
import {
  IPaginationOptions,
  paginationHelper,
} from "../../utils/paginationHelpers";
import AppError from "../../errors/AppError";
import { createDateFilter } from "../../utils/Date/parseAnyDate";
import prisma from "../../utils/prisma";
import { clouddebugger } from "googleapis/build/src/apis/clouddebugger";


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
//     // console.log("unassigned");
//     // Unassigned = assignTo is null OR field missing
//     whereClause.Agent = {
//       OR: [
//         { assignTo: null },
//         {
//           assignTo: {
//             isSet: false,
//           },
//         },
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

//   // console.log(whereClause);

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
//             isAvailable: true,
//             status: true,
//             assignTo: true,
//             assignments: {
//               where: {
//                 NOT: {
//                   status: AssignmentStatus.REJECTED,
//                 },
//               },
//               select: {
//                 id: true,
//                 status: true,
//                 agentUserId: true,
//                 organizationId: true,
//                 assignedBy: true,
//               },
//             },
//             successCalls: true,
//             droppedCalls: true,
//             // assignments: {
//             //   where: {
//             //     status: {
//             //       not: "REJECTED",
//             //     },
//             //   },
//             //   select: {
//             //     id: true,
//             //     status: true,
//             //     agentUserId: true,
//             //     organizationId: true,
//             //     assignedBy: true,
//             //   },
//             // },
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

//   // console.log(users);

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
//           totalCalls:
//             (user.Agent.successCalls || 0) + (user.Agent.droppedCalls || 0),
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
//         totalCalls: 0,
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
// const getAllAgentIds = async (user: User) => {
//   let agents;

//   if (user?.role === UserRole.super_admin) {
//     agents = await prisma.agent.findMany({
//       select: {
//         id: true,
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });
//   } else if (user?.role === UserRole.organization_admin) {
//     const org = await prisma.organization.findFirst({
//       where: { ownerId: user.id },
//       select: { id: true },
//     });

//     if (!org) {
//       throw new Error("Organization not found for this admin!");
//     }

//     agents = await prisma.agent.findMany({
//       where: {
//         assignments: {
//           some: {
//             organizationId: org.id,
//             status:
//               AssignmentStatus.APPROVED || AssignmentStatus.REMOVAL_REQUESTED,
//           },
//         },
//       },
//       select: {
//         id: true,
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });
//   }

//   return agents;
// };

// const getAgentsManagementInfo = async (
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
//       { Agent: { employeeId: { contains: searchTerm, mode: "insensitive" } } },
//     ];
//   }

//   if (searchTerm === "employeeId") {
//     whereClause.Agent = {};
//   }

//   // console.log(whereClause);

//   const [users, total] = await Promise.all([
//     prisma.user.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         // "id": "68c307fe072c5a263a704f89",
//         //             "userId": "68c307fd072c5a263a704f88",
//         //             "status": "offline",
//         //             "sip_address": "sip:agentsanim65934@test-uprank.sip.twilio.com",
//         //             "sip_username": "agentsanim65934",
//         //             "sip_password": "Securepassword123",
//         //             "dateOfBirth": "2000-01-01T00:00:00.000Z",
//         //             "gender": "male",
//         //             "address": "Updated Address Street",
//         //             "emergencyPhone": "01743034999",
//         //             "ssn": "12347-455-43789",
//         //             "skills": [
//         //                 "customer service",
//         //                 "sales",
//         //                 "technical support",
//         //                 "communication"
//         //             ],
//         //             "employeeId": null,
//         //             "isAvailable": true,
//         //             "assignTo": "68c211cc6864cb0ea1959230",
//         //             "jobTitle": "Senior Customer Service Agent",
//         //             "employmentType": "full_time",
//         //             "department": "Customer Success",
//         //             "workEndTime": "17:00:00",
//         //             "workStartTime": "09:00:00",
//         Agent: true,
//         // bio: true,
//         // image: true,
//         // Agent: true,
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

// const getAllAgentForAdmin = async (
//   options: IPaginationOptions,
//   filters: any = {}
// ) => {
//   const searchTerm = filters?.searchTerm as string;
//   const assignmentStatus = filters?.viewType as string;
//   const isAvailable = filters?.isAvailable as boolean | string;
//   const startDate = filters?.startDate as string; // New: start date filter
//   const endDate = filters?.endDate as string; // New: end date filter

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
//             assignTo: true,
//             assignments: {
//               where: {
//                 NOT: {
//                   status: AssignmentStatus.REJECTED,
//                 },
//               },
//               select: {
//                 id: true,
//                 organization: {
//                   select: {
//                     id: true,
//                     name: true,
//                   },
//                 },
//                 agentUserId: true,
//                 status: true,
//                 assignedBy: true,
//               },
//             },
//             organization: {
//               select: {
//                 id: true,
//                 name: true,
//                 industry: true,
//               },
//             },
//             // assignments: {
//             //   select: {
//             //     id: true,
//             //     status: true,
//             //     assignedAt: true,
//             //     organization: {
//             //       select: {
//             //         id: true,
//             //         name: true,
//             //         industry: true,
//             //       },
//             //     },
//             //   },
//             //   orderBy: {
//             //     assignedAt: "desc",
//             //   },
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

//   // Calculate average rating for each agent using the fetched feedbacks
//   const usersWithAvgRating = users.map((user) => {
//     // Safe access to nested properties with optional chaining and fallbacks
//     const agent = user?.Agent;
//     const feedbacks = agent?.AgentFeedbacks || [];

//     // Calculate average rating
//     const totalRating = feedbacks.reduce(
//       (sum, feedback) => sum + feedback.rating,
//       0
//     );
//     const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

//     // Get the latest assignment

//     return {
//       ...user,
//       Agent: {
//         id: agent?.id || null,
//         skills: agent?.skills || [],
//         totalCalls: (agent?.successCalls || 0) + (agent?.droppedCalls || 0),
//         successCalls: agent?.successCalls || 0,
//         droppedCalls: agent?.droppedCalls || 0,
//         isAvailable: agent?.isAvailable ?? false,
//         status: agent?.status || null,
//         AgentFeedbacks: feedbacks,
//         organization: agent?.organization || null,
//         assignments: agent?.assignments || [],
//         assignTo: agent?.assignTo || null,

//         avgRating: parseFloat(avgRating.toFixed(1)),
//         totalFeedbacks: feedbacks.length,
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



// ========== GET ALL AGENT FROM DB (Updated) ==========
const getAllAgentFromDB = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  const searchTerm = filters?.searchTerm as string;
  const isAvailable = filters?.isAvailable as boolean | string;
  const viewType = filters?.viewType as "all" | "my-agents" | "unassigned" | "created-by-me";
  const privacy = filters?.privacy as agentPrivacy;

  //  UPDATED: Added "created-by-me" view type
  if (
    viewType !== undefined &&
    viewType !== "all" &&
    viewType !== "my-agents" &&
    viewType !== "unassigned" &&
    viewType !== "created-by-me"
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
  if (user?.role === UserRole.organization_admin) {
    const userOrganization = await prisma.organization.findUnique({
      where: { ownerId: user?.id },
    });

    if (!userOrganization) {
      throw new AppError(
        status.NOT_FOUND,
        "Organization not found for this user!"
      );
    }

    if (viewType === "my-agents") {
      // ✅ UPDATED: Check if org ID is in assignTo array
      whereClause.Agent = {
        assignTo: {
          has: userOrganization?.id,
        },
      };
    } else if (viewType === "created-by-me") {
      // ✅ NEW: View agents created by this organization
      whereClause.Agent = {
        creatorId: user.id,
      };
    } else if (viewType === "unassigned") {
      // ✅ FIXED: Unassigned agents (empty assignTo array)
      whereClause.Agent = {
        OR: [
          // { assignTo: { isSet: false } },
          { assignTo: { equals: null } },
          { assignTo: { isEmpty: true } },
          // {assignTo: { isSet: false}}
        ],
        privacy: agentPrivacy.public,
      };
    } else if (viewType === "all") {
      // ✅ NEW: All public agents + my created agents
      whereClause.Agent = {
        OR: [
          { privacy: agentPrivacy.public },
          { creatorId: user.id },
        ],
      };
    }
  }

  //  NEW: Privacy filter
  if (privacy) {
    whereClause.Agent = {
      ...whereClause.Agent,
      privacy: privacy,
    };
  }

  // Search functionality
  if (searchTerm) {
    whereClause.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { email: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm, mode: "insensitive" } },
      { Agent: { employeeId: { contains: searchTerm, mode: "insensitive" } } },
    ];
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
        bio: true,
        image: true,
        createdAt: true, // ✅ NEW: Include creation date
        Agent: {
          select: {
            id: true,
            employeeId: true, // ✅ NEW
            skills: true,
            isAvailable: true,
            status: true,
            assignTo: true, // ✅ Now returns array
            privacy: true, // ✅ NEW
            jobTitle: true, // ✅ NEW
            department: true, // ✅ NEW
            employmentType: true, // ✅ NEW
            successCalls: true,
            droppedCalls: true,
            creatorId: true, // ✅ NEW
            creator: { // ✅ NEW: Include creator info
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            AgentFeedbacks: {
              select: {
                id: true,
                rating: true,
              },
            },
            assignments: {
              // where: {
              //   NOT: {
              //     status: AssignmentStatus.REJECTED,
              //   },
              // },
              select: {
                id: true,
                status: true,
                agentUserId: true,
                organizationId: true,
                assignedBy: true,
                assignedAt: true, // ✅ NEW
                approvedAt: true, // ✅ NEW
                organization: { // ✅ NEW: Include org details
                  select: {
                    id: true,
                    name: true,
                    industry: true,
                  },
                },
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

  console.log(users)

  // Calculate average rating for each agent using the fetched feedbacks
  // const usersWithAvgRating = users.map((user) => {
  //   if (user.Agent && user.Agent.AgentFeedbacks) {
  //     const feedbacks = user.Agent.AgentFeedbacks;
  //     const totalRating = feedbacks.reduce(
  //       (sum, feedback) => sum + feedback.rating,
  //       0
  //     );
  //     const avgRating =
  //       feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

  //     return {
  //       ...user,
  //       Agent: {
  //         ...user.Agent,
  //         totalCalls:
  //           (user.Agent.successCalls || 0) + (user.Agent.droppedCalls || 0),
  //         avgRating: parseFloat(avgRating.toFixed(1)),
  //         totalFeedbacks: feedbacks.length,
  //         assignedOrganizationsCount: user.Agent?.assignTo?.length || 0, // ✅ FIXED: Safe array length check
  //       },
  //     };
  //   }

  //   return {
  //     ...user,
  //     Agent: {
  //       ...user.Agent,
  //       avgRating: 0,
  //       totalFeedbacks: 0,
  //       totalCalls: 0,
  //       assignedOrganizationsCount: user.Agent?.assignTo?.length || 0, // ✅ FIXED: Safe array length check
  //     },
  //   };
  // });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    users: users,
    // users: usersWithAvgRating,
  };
};
// ========== GET ALL AGENT IDS (Updated) ==========
const getAllAgentIds = async (user: User) => {
  let agents;

  if (user?.role === UserRole.super_admin) {
    agents = await prisma.agent.findMany({
      select: {
        id: true,
        userId: true, // ✅ NEW: Include userId
        employeeId: true, // ✅ NEW
        privacy: true, // ✅ NEW
        assignTo: true, // ✅ NEW: Array of org IDs
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

    // ✅ UPDATED: Use assignTo array check
    agents = await prisma.agent.findMany({
      where: {
        assignTo: {
          has: org.id, // Check if array contains org ID
        },
      },
      select: {
        id: true,
        userId: true,
        employeeId: true,
        privacy: true,
        assignTo: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // ✅ ALTERNATIVE: Filter by approved assignments
    // agents = await prisma.agent.findMany({
    //   where: {
    //     assignments: {
    //       some: {
    //         organizationId: org.id,
    //         status: {
    //           in: [AssignmentStatus.APPROVED, AssignmentStatus.REMOVAL_REQUESTED],
    //         },
    //       },
    //     },
    //   },
    //   select: {
    //     id: true,
    //     userId: true,
    //     employeeId: true,
    //     privacy: true,
    //     assignTo: true,
    //     user: {
    //       select: {
    //         id: true,
    //         name: true,
    //         email: true,
    //       },
    //     },
    //   },
    // });
  }

  return agents;
};

// ========== GET AGENTS MANAGEMENT INFO (Updated) ==========
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
      { Agent: { employeeId: { contains: searchTerm, mode: "insensitive" } } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true, // ✅ NEW
        bio: true, // ✅ NEW
        createdAt: true, // ✅ NEW
        Agent: {
          select: {
            id: true,
            userId: true,
            status: true,
            employeeId: true,
            dateOfBirth: true,
            gender: true,
            address: true,
            emergencyPhone: true,
            ssn: true,
            skills: true,
            isAvailable: true,
            assignTo: true, // ✅ Now array
            privacy: true, // ✅ NEW
            jobTitle: true,
            employmentType: true,
            department: true,
            successCalls: true,
            droppedCalls: true,
            creatorId: true, // ✅ NEW
            otherInfo: true,
            createdAt: true,
            updatedAt: true,
            creator: { // ✅ NEW
              select: {
                id: true,
                name: true,
                email: true,
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

  // ✅ NEW: Add computed fields
  const enrichedUsers = users.map((user) => ({
    ...user,
    Agent: user.Agent ? {
      ...user.Agent,
      assignedOrganizationsCount: user.Agent.assignTo.length,
      totalCalls: (user.Agent.successCalls || 0) + (user.Agent.droppedCalls || 0),
    } : null,
  }));

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: enrichedUsers,
  };
};

// ========== GET ALL AGENT FOR ADMIN (Updated) ==========
const getAllAgentForAdmin = async (
  options: IPaginationOptions,
  filters: any = {}
) => {
  const searchTerm = filters?.searchTerm as string;
  const assignmentStatus = filters?.viewType as string;
  const isAvailable = filters?.isAvailable as boolean | string;
  const startDate = filters?.startDate as string;
  const endDate = filters?.endDate as string;
  const privacy = filters?.privacy as agentPrivacy; // ✅ NEW

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
      { Agent: { employeeId: { contains: searchTerm, mode: "insensitive" } } },
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

  // ✅ NEW: Privacy filter
  if (privacy) {
    whereClause.Agent = {
      ...whereClause.Agent,
      privacy: privacy,
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
            employeeId: true, // ✅ NEW
            skills: true,
            successCalls: true,
            droppedCalls: true,
            isAvailable: true,
            status: true,
            privacy: true, // ✅ NEW
            assignTo: true, // ✅ Now array
            creatorId: true, // ✅ NEW
            creator: { // ✅ NEW
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            AgentFeedbacks: {
              select: {
                id: true,
                rating: true,
              },
            },
            assignments: {
              where: {
                NOT: {
                  status: AssignmentStatus.REJECTED,
                },
              },
              select: {
                id: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    industry: true, // ✅ NEW
                  },
                },
                agentUserId: true,
                status: true,
                assignedBy: true,
                assignedAt: true, // ✅ NEW
                approvedAt: true, // ✅ NEW
              },
            },
            // ✅ REMOVED: Direct organization relation
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
    const agent = user?.Agent;
    const feedbacks = agent?.AgentFeedbacks || [];

    const totalRating = feedbacks.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    return {
      ...user,
      Agent: {
        id: agent?.id || null,
        employeeId: agent?.employeeId || null, // ✅ NEW
        skills: agent?.skills || [],
        totalCalls: (agent?.successCalls || 0) + (agent?.droppedCalls || 0),
        successCalls: agent?.successCalls || 0,
        droppedCalls: agent?.droppedCalls || 0,
        isAvailable: agent?.isAvailable ?? false,
        status: agent?.status || null,
        privacy: agent?.privacy || null, // ✅ NEW
        assignTo: agent?.assignTo || [], // ✅ UPDATED: Default to empty array
        creatorId: agent?.creatorId || null, // ✅ NEW
        creator: agent?.creator || null, // ✅ NEW
        AgentFeedbacks: feedbacks,
        assignments: agent?.assignments || [],
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalFeedbacks: feedbacks.length,
        assignedOrganizationsCount: agent?.assignTo?.length || 0, // ✅ NEW
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


const getAgentCallsManagementInfo = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  let searchTerm = filters?.searchTerm as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  // Build where clause for Call model
  let whereClause: any = {
    agentId: user?.id,
  };

  // If search term exists, ADD search conditions to the existing whereClause
  if (searchTerm) {
    whereClause.AND = [
      {
        OR: [
          { from_number: { contains: searchTerm, mode: "insensitive" } },
          { to_number: { contains: searchTerm, mode: "insensitive" } },
          { call_status: { contains: searchTerm, mode: "insensitive" } },
          { callType: { contains: searchTerm, mode: "insensitive" } },
          // {
          //   Agent: {
          //     employeeId: { contains: searchTerm, mode: "insensitive" },
          //   },
          // },
        ],
      },
    ];
  }
  // console.log(whereClause);

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        agentId: true,
        from_number: true,
        to_number: true,
        call_time: true,
        callType: true,
        call_status: true,
        call_duration: true,
        call_started_at: true,
        call_completed_at: true,
        call_transcript: true,
        recording_duration: true,
        recording_status: true,
        recording_url: true,

        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.call.count({
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
    data: calls,
  };
};
// Request assignment (Organization Admin)
// const requestAgentAssignment = async (agentUserId: string, user: User) => {
//   // Use transaction for data consistency
//   return await prisma.$transaction(async (tx) => {
//     // 1. Validate agent exists
//     const agent = await tx.agent.findUnique({
//       where: { userId: agentUserId },
//       include: { user: true },
//     });

//     if (!agent) {
//       throw new ApiError(status.NOT_FOUND, "Agent not found!");
//     }

//     // status: 'ACTIVE',
//     //   planLevel: 'only_real_agent',
//     // 2. Validate organization exists and user owns it
//     // 2. Validate organization exists and user owns it
//     const organization = await tx.organization.findUnique({
//       where: { ownerId: user.id },
//       include: {
//         subscriptions: true,
//         AgentAssignment: {
//           where: {
//             status: {
//               in: [
//                 AssignmentStatus.APPROVED,
//                 AssignmentStatus.REMOVAL_REQUESTED,
//                 AssignmentStatus.PENDING,
//               ],
//             },
//           },
//         },
//       },
//     });

//     if (!organization) {
//       throw new ApiError(status.NOT_FOUND, "Organization not found!");
//     }

//     // 🔎 Check active subscription
//     const activeSubscription = organization.subscriptions.find(
//       (sub) => sub.status === SubscriptionStatus.ACTIVE
//     );

//     if (!activeSubscription) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "⚠️ Your organization has no active subscription!"
//       );
//     }

//     // 🔎 Check agent limit
//     // const currentAssignedAgents = organization.AgentAssignment.length;
//     // // console.log("Current Assigned Agents:", currentAssignedAgents)
//     // if (
//     //   activeSubscription.numberOfAgents &&
//     //   currentAssignedAgents >= activeSubscription.numberOfAgents
//     // ) {
//     //   throw new ApiError(
//     //     status.BAD_REQUEST,
//     //     `⚠️ Agent limit reached! Your subscription only allows ${activeSubscription.numberOfAgents} agent(s).`
//     //   );
//     // }

//     // 🔎 Count assigned & pending
//     const currentAssignedAgents = organization.AgentAssignment.filter(
//       (a) =>
//         a.status === AssignmentStatus.APPROVED ||
//         a.status === AssignmentStatus.REMOVAL_REQUESTED
//     ).length;

//     const pendingRequests = organization.AgentAssignment.filter(
//       (a) => a.status === AssignmentStatus.PENDING
//     ).length;

//     // ✅ Total requests = already assigned + pending
//     const totalRequests = currentAssignedAgents + pendingRequests;

//     if (
//       activeSubscription.numberOfAgents &&
//       totalRequests >= activeSubscription.numberOfAgents
//     ) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         `⚠️ Agent limit reached! Your subscription allows ${activeSubscription.numberOfAgents} agent(s). Already Assigned: ${currentAssignedAgents} agents, Pending: ${pendingRequests} requests.`
//       );
//     }

//     // 3. Check if agent has active assignments in other organizations
//     const activeOtherAssignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: agentUserId,
//         organizationId: { not: organization.id },
//         status: {
//           in: [
//             AssignmentStatus.PENDING,
//             AssignmentStatus.APPROVED,
//             AssignmentStatus.REMOVAL_REQUESTED,
//           ],
//         },
//       },
//     });

//     if (activeOtherAssignment) {
//       const errorMessages: any = {
//         [AssignmentStatus.PENDING]:
//           "⚠️ Agent has a pending request in another organization!",
//         [AssignmentStatus.APPROVED]:
//           "✅ Agent is already working in another organization!",
//         [AssignmentStatus.REMOVAL_REQUESTED]:
//           "🔄 Agent has a removal request pending in another organization!",
//       };

//       throw new ApiError(
//         status.BAD_REQUEST,
//         errorMessages[activeOtherAssignment.status] ||
//           `Cannot assign agent: ${activeOtherAssignment.status} in another organization`
//       );
//     }

//     // 4. Check for existing assignment for this organization
//     const existingAssignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: agentUserId,
//         organizationId: organization.id,
//         status: {
//           in: [
//             AssignmentStatus.PENDING,
//             AssignmentStatus.APPROVED,
//             AssignmentStatus.REMOVAL_REQUESTED,
//           ],
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     if (existingAssignment) {
//       const errorMessages: any = {
//         [AssignmentStatus.PENDING]: "⚠️ Assignment request is already pending!",
//         [AssignmentStatus.APPROVED]:
//           "✅ Agent is already assigned to your organization!",
//         [AssignmentStatus.REMOVAL_REQUESTED]:
//           "⚠️ Agent removal is already requested. Please wait for admin approval.",
//       };

//       throw new ApiError(
//         status.BAD_REQUEST,
//         errorMessages[existingAssignment.status] ||
//           `Existing assignment with status: ${existingAssignment.status}`
//       );
//     }

//     // 5. Create assignment request
//     const assignment = await tx.agentAssignment.create({
//       data: {
//         agentUserId: agentUserId,
//         organizationId: organization.id,
//         assignedBy: user.id,
//         status: AssignmentStatus.PENDING,
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     return assignment;
//   });
// };

// ========== REQUEST AGENT ASSIGNMENT ==========
const requestAgentAssignment = async (agentUserId: string, user: User) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate agent exists
    const agent = await tx.agent.findUnique({
      where: { userId: agentUserId },
      include: {
        user: true,
        creator: true,
      },
    });

    if (!agent) {
      throw new ApiError(status.NOT_FOUND, "Agent not found!");
    }

    // 2. Validate organization exists
    const organization = await tx.organization.findUnique({
      where: { ownerId: user.id },
      include: {
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
        },
        AgentAssignment: {
          where: {
            status: {
              in: [
                AssignmentStatus.APPROVED,
                AssignmentStatus.REMOVAL_REQUESTED,
                AssignmentStatus.PENDING,
              ],
            },
          },
        },
      },
    });

    if (!organization) {
      throw new ApiError(status.NOT_FOUND, "Organization not found!");
    }

    // 3. Privacy validation
    if (agent.privacy === agentPrivacy.private) {
      console.log(agent.creatorId, user.id)
      if (agent.creatorId !== user.id) {
        throw new ApiError(
          status.FORBIDDEN,
          "⚠️ This is a private agent! Only the creating organization can access this agent."
        );
      }

      if (agent.assignTo.includes(organization.id)) {
        throw new ApiError(
          status.BAD_REQUEST,
          "✅ This private agent is already assigned to your organization!"
        );
      }

      // throw new ApiError(
      //   status.BAD_REQUEST,
      //   "⚠️ Private agents are automatically assigned. No action needed."
      // );
    }

    // 4. Check if already assigned to this org
    if (agent.assignTo.includes(organization.id)) {
      throw new ApiError(
        status.BAD_REQUEST,
        "✅ Agent is already assigned to your organization!"
      );
    }

    // 5. Check subscription
    const activeSubscription = organization.subscriptions[0];
    if (!activeSubscription) {
      throw new ApiError(
        status.BAD_REQUEST,
        "⚠️ Your organization has no active subscription!"
      );
    }

    // 6. Check agent limit
    const currentAssignedAgents = organization.AgentAssignment.filter(
      (a) =>
        a.status === AssignmentStatus.APPROVED ||
        a.status === AssignmentStatus.REMOVAL_REQUESTED
    ).length;

    const pendingRequests = organization.AgentAssignment.filter(
      (a) => a.status === AssignmentStatus.PENDING
    ).length;

    const totalRequests = currentAssignedAgents + pendingRequests;

    if (
      activeSubscription.numberOfAgents &&
      totalRequests >= activeSubscription.numberOfAgents
    ) {
      throw new ApiError(
        status.BAD_REQUEST,
        `⚠️ Agent limit reached! Your subscription allows ${activeSubscription.numberOfAgents} agent(s). Assigned: ${currentAssignedAgents}, Pending: ${pendingRequests}.`
      );
    }

    // 7. Check for existing assignment
    const existingAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: organization.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingAssignment) {
      if (existingAssignment.status === AssignmentStatus.PENDING) {
        throw new ApiError(
          status.BAD_REQUEST,
          "⚠️ Assignment request is already pending!"
        );
      } else if (existingAssignment.status === AssignmentStatus.APPROVED) {
        throw new ApiError(
          status.BAD_REQUEST,
          "✅ Agent is already assigned to your organization!"
        );
      } else if (
        existingAssignment.status === AssignmentStatus.REMOVAL_REQUESTED
      ) {
        throw new ApiError(
          status.BAD_REQUEST,
          "⚠️ Agent removal is already requested. Please wait for admin approval."
        );
      }
    }

    // 8. Create assignment request
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



// // Approve assignment (Admin only) - Find by agentUserId and organizationId
// const approveAssignment = async (
//   agentUserId: string,
//   organizationId: string
// ) => {
//   return await prisma.$transaction(async (tx) => {
//     // Find the assignment by agentUserId and organizationId
//     const assignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: agentUserId,
//         organizationId: organizationId,
//         status: AssignmentStatus.PENDING,
//       },
//       include: { agent: true },
//     });

//     if (!assignment) {
//       throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
//     }

//     // if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
//     //   throw new ApiError(
//     //     status.BAD_REQUEST,
//     //     "Assignment request is not in removal requested status!"
//     //   );
//     // }

//     // Check if agent already has an active assignment in other organizations
//     const activeAssignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: agentUserId,
//         status: AssignmentStatus.APPROVED,
//         organizationId: { not: organizationId }, // Check other organizations
//       },
//     });

//     if (activeAssignment) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Agent already has an active assignment to another organization!"
//       );
//     }

//     // Update the assignment status to APPROVED using the assignment ID
//     const updatedAssignment = await tx.agentAssignment.update({
//       where: { id: assignment.id }, // Use the found assignment's ID
//       data: {
//         status: AssignmentStatus.APPROVED,
//         approvedAt: new Date(),
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     // Update the agent's assignTo field
//     await tx.agent.update({
//       where: { userId: agentUserId },
//       data: {
//         assignTo: organizationId,
//         isAvailable: true,
//       },
//     });

//     return updatedAssignment;
//   });
// };

// // Reject assignment (Admin only)
// const rejectAssignment = async (
//   userId: string,
//   organizationId: string,
//   reason?: string
// ) => {
//   return await prisma.$transaction(async (tx) => {
//     // Find the assignment by userId (agentUserId) and organizationId
//     const assignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: userId,
//         organizationId: organizationId,
//         status: AssignmentStatus.PENDING,
//       },
//       include: {
//         agent: true,
//       },
//     });

//     if (!assignment) {
//       throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
//     }

//     // if (assignment.status !== AssignmentStatus.PENDING) {
//     //   throw new ApiError(
//     //     status.BAD_REQUEST,
//     //     `Cannot reject assignment with status: ${assignment.status}. Only PENDING assignments can be rejected.`
//     //   );
//     // }

//     // Update the assignment status to REJECTED using the found assignment's ID
//     const updatedAssignment = await tx.agentAssignment.update({
//       where: { id: assignment.id },
//       data: {
//         status: AssignmentStatus.REJECTED,
//         rejectedAt: new Date(),
//         reason: reason,
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     // Only remove organization assignment if this was the current one
//     if (assignment.agent.assignTo === assignment.organizationId) {
//       await tx.agent.update({
//         where: { userId: assignment.agentUserId },
//         data: {
//           assignTo: null,
//           isAvailable: true,
//         },
//       });
//     }

//     return updatedAssignment;
//   });
// };

// ========== APPROVE ASSIGNMENT ==========
const approveAssignment = async (
  agentUserId: string,
  organizationId: string
) => {
  console.log("approveAssignment", agentUserId, organizationId);
  await prisma.$connect()
  return await prisma.$transaction(async (tx) => {
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

    // Privacy check
    if (assignment.agent.privacy === agentPrivacy.private) {
      if (assignment.agent.assignTo.length > 0) {
        throw new ApiError(
          status.BAD_REQUEST,
          "⚠️ This private agent is already assigned to another organization!"
        );
      }
    }

    // Update assignment
    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id },
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

    // Add organization to assignTo array
    await tx.agent.update({
      where: { userId: agentUserId },
      data: {
        assignTo: {
          push: organizationId,
        },
        isAvailable: true,
      },
    });

    return updatedAssignment;
  });
};

// ========== REJECT ASSIGNMENT ==========
const rejectAssignment = async (
  userId: string,
  organizationId: string,
  reason?: string
) => {
  return await prisma.$transaction(async (tx) => {
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

    const updatedAssignment = await tx.agentAssignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.REJECTED,
        rejectedAt: new Date(),
        reason: reason || "Assignment rejected by admin.",
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


// // Organization admin requests agent removal to super admin
// const requestAgentRemoval = async (agentUserId: string, user: User) => {
//   // Validate input
//   if (!agentUserId || !user?.id) {
//     throw new ApiError(
//       status.BAD_REQUEST,
//       "Agent user ID and user information are required!"
//     );
//   }

//   return await prisma.$transaction(async (tx) => {
//     // Validate agent exists
//     const agent = await tx.agent.findUnique({
//       where: { userId: agentUserId },
//       include: { user: true },
//     });

//     if (!agent) {
//       throw new ApiError(status.NOT_FOUND, "Agent not found!");
//     }

//     // Validate organization exists and user owns it
//     const organization = await tx.organization.findUnique({
//       where: { ownerId: user.id },
//     });

//     if (!organization) {
//       throw new ApiError(status.NOT_FOUND, "Organization not found!");
//     }

//     // Check if agent is actually assigned to this organization
//     if (agent.assignTo !== organization.id) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Agent is not assigned to your organization!"
//       );
//     }

//     // Find the existing approved assignment
//     const existingAssignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: agentUserId,
//         organizationId: organization.id,
//         status: AssignmentStatus.APPROVED,
//       },
//     });

//     if (!existingAssignment) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "No approved assignment found for this agent!"
//       );
//     }

//     // Update assignment status to REMOVAL_REQUESTED
//     const updatedAssignment = await tx.agentAssignment.update({
//       where: { id: existingAssignment.id },
//       data: {
//         status: AssignmentStatus.REMOVAL_REQUESTED,
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     return updatedAssignment;
//   });
// };

// // Super admin approves removal request
// const approveAgentRemoval = async (userId: string, organizationId: string) => {
//   return await prisma.$transaction(async (tx) => {
//     // Find the removal request by userId (agentUserId) and organizationId
//     const assignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: userId,
//         organizationId: organizationId,
//         status: AssignmentStatus.REMOVAL_REQUESTED,
//       },
//       include: {
//         agent: true,
//       },
//     });

//     if (!assignment) {
//       throw new ApiError(status.NOT_FOUND, "Removal request not found!");
//     }

//     if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Assignment is not in removal requested status!"
//       );
//     }

//     // Update assignment status to REJECTED (final removal)
//     const updatedAssignment = await tx.agentAssignment.update({
//       where: { id: assignment.id },
//       data: {
//         status: AssignmentStatus.REJECTED,
//         rejectedAt: new Date(),
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     // Remove agent from organization
//     await tx.agent.update({
//       where: { userId: assignment.agentUserId },
//       data: {
//         assignTo: null,
//         isAvailable: true,
//       },
//     });

//     return updatedAssignment;
//   });
// };

// // Super admin rejects removal request
// const rejectAgentRemoval = async (
//   userId: string,
//   organizationId: string,
//   reason?: string
// ) => {
//   return await prisma.$transaction(async (tx) => {
//     // Find the removal request by userId (agentUserId) and organizationId
//     const assignment = await tx.agentAssignment.findFirst({
//       where: {
//         agentUserId: userId,
//         organizationId: organizationId,
//         status: AssignmentStatus.REMOVAL_REQUESTED,
//       },
//       include: {
//         agent: true,
//       },
//     });

//     if (!assignment) {
//       throw new ApiError(status.NOT_FOUND, "Removal request not found!");
//     }

//     if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
//       throw new ApiError(
//         status.BAD_REQUEST,
//         "Assignment is not in removal requested status!"
//       );
//     }

//     // Revert back to APPROVED status
//     const updatedAssignment = await tx.agentAssignment.update({
//       where: { id: assignment.id },
//       data: {
//         status: AssignmentStatus.APPROVED,
//         rejectedAt: null,
//         reason:
//           reason ||
//           "Removal request rejected by admin. Please contact super admin.",
//       },
//       include: {
//         agent: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//               },
//             },
//           },
//         },
//         organization: true,
//         assignedByUser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//           },
//         },
//       },
//     });

//     return updatedAssignment;
//   });
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

//   let whereClause: any = {
//     // status: AssignmentStatus.REMOVAL_REQUESTED,
//   };

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
//     // Calculate average rating for the agent
//     const feedbacks = request.agent.AgentFeedbacks || [];
//     const totalRating = feedbacks.reduce(
//       (sum, feedback) => sum + feedback.rating,
//       0
//     );
//     const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

//     // Main user data structure (same as getAllAgentFromDB)
//     const userData = {
//       id: request.agent.user.id,
//       name: request.agent.user.name,
//       email: request.agent.user.email,
//       phone: request.agent.user.phone,
//       bio: request.agent.user.bio,
//       image: request.agent.user.image,
//       role: request.agent.user.role,
//       status: request.agent.user.status,

//       // Agent-specific data (matching your Agent model structure)
//       Agent: {
//         id: request.agent.id,
//         skills: request.agent.skills || [],
//         isAvailable: request.agent.isAvailable,
//         status: request.agent.status,
//         assignTo: request.agent.assignTo,

//         // Organization data
//         organization: request.organization
//           ? {
//             id: request.organization.id,
//             name: request.organization.name,
//             industry: request.organization.industry,
//             address: request.organization.address,
//             websiteLink: request.organization.websiteLink,
//           }
//           : null,

//         // Assignments data
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

//         // AgentFeedbacks with average rating
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
//     users: formattedData, // Using 'users' key to match getAllAgentFromDB
//   };
// };


// Updated Service Functions for Multi-Organization Assignment

// ========== REQUEST AGENT REMOVAL (Updated) ==========
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
      include: {
        user: true,
        creator: true, // Include creator to check ownership
      },
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

    //  UPDATED: Check if organization is in assignTo array
    if (!agent.assignTo.includes(organization.id)) {
      throw new ApiError(
        status.BAD_REQUEST,
        "Agent is not assigned to your organization!"
      );
    }

    //  NEW: Check if it's a private agent created by this org
    // if (agent.privacy === agentPrivacy.private && agent.creatorId === user.id) {
    //   throw new ApiError(
    //     status.BAD_REQUEST,
    //     "⚠️ You cannot request removal of your own private agent. Private agents are permanently assigned to the creator organization."
    //   );
    // }

    // Find the existing approved assignment
    const existingAssignment = await tx.agentAssignment.findFirst({
      where: {
        agentUserId: agentUserId,
        organizationId: organization.id,
        status: AssignmentStatus.APPROVED || AssignmentStatus.REMOVAL_REQUESTED,
      },
    });

    if (!existingAssignment) {
      throw new ApiError(
        status.BAD_REQUEST,
        "No approved assignment found for this agent!"
      );
    }

    if (existingAssignment) {
      if (existingAssignment.status === AssignmentStatus.REMOVAL_REQUESTED) {
        throw new ApiError(
          status.BAD_REQUEST,
          "⚠️ Agent removal is already requested. Please wait for admin approval."
        );
      }
      // else if(existingAssignment.status === AssignmentStatus.APPROVED){
      //   throw new ApiError(
      //     status.BAD_REQUEST,
      //     "✅ Agent is already assigned to your organization!"
      //   );
      // }
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
            creator: {
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

// ========== APPROVE AGENT REMOVAL (Updated) ==========
const approveAgentRemoval = async (userId: string, organizationId: string) => {
  // console.log(userId, organizationId)
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

    //  NEW: Check if it's a private agent being removed from creator's org
    // if (
    //   assignment.agent.privacy === agentPrivacy.private &&
    //   assignment.agent.creatorId === assignment.assignedBy
    // ) {
    //   throw new ApiError(
    //     status.BAD_REQUEST,
    //     "⚠️ Cannot remove a private agent from its creator organization!"
    //   );
    // }
    if (
      assignment.agent.creatorId !== assignment.assignedBy
    ) {
      throw new ApiError(
        status.BAD_REQUEST,
        "⚠️ Only creator of the agent can remove it from your organization!"
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
            creator: {
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

    //  UPDATED: Remove organization from assignTo array
    const currentAssignTo = assignment.agent.assignTo.filter(
      (orgId) => orgId !== organizationId
    );

    await tx.agent.update({
      where: { userId: assignment.agentUserId },
      data: {
        assignTo: currentAssignTo,
        isAvailable: true,
      },
    });

    return updatedAssignment;
  });
};

// ========== REJECT AGENT REMOVAL (Updated) ==========
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
        agent: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
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
            creator: {
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

    //  NOTE: No need to update assignTo array since we're rejecting removal
    // Agent remains assigned to the organization

    return updatedAssignment;
  });
};

// ========== GET APPROVAL REMOVAL REQUESTS FOR SUPER ADMIN (Updated) ==========
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

  let whereClause: any = {};

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
        agent: {
          employeeId: { contains: searchTerm, mode: "insensitive" },
        },
      },
      {
        organization: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
      // {
      //   reason: { contains: searchTerm, mode: "insensitive" },
      // },
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
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
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
        assignedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
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
        employeeId: request.agent.employeeId,
        skills: request.agent.skills || [],
        isAvailable: request.agent.isAvailable,
        status: request.agent.status,
        privacy: request.agent.privacy, //  NEW: Include privacy
        assignTo: request.agent.assignTo, //  UPDATED: Now an array
        creatorId: request.agent.creatorId, //  NEW: Include creator ID
        creator: request.agent.creator, //  NEW: Include creator info

        // Organization data - current request's organization
        organization: request.organization
          ? {
            id: request.organization.id,
            name: request.organization.name,
            industry: request.organization.industry,
            address: request.organization.address,
            websiteLink: request.organization.websiteLink,
          }
          : null,

        // Assignments data - current request details
        assignments: [
          {
            id: request.id,
            status: request.status,
            assignedAt: request.assignedAt,
            approvedAt: request.approvedAt,
            rejectedAt: request.rejectedAt,
            reason: request.reason,
            organizationId: request.organizationId,
            assignedBy: request.assignedBy,
            assignedByUser: request.assignedByUser,
          },
        ],

        // AgentFeedbacks with average rating
        AgentFeedbacks: feedbacks,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalFeedbacks: feedbacks.length,
        assignedOrganizationsCount: request.agent.assignTo.length, //  NEW: Count of assigned orgs
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




// *****************  unused function  *****************
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
  getAgentCallsManagementInfo,
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
