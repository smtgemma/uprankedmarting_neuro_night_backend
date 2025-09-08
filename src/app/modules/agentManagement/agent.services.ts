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
    console.log("unassigned");
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

  console.log(whereClause)

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
            totalCalls: true,
            isAvailable: true,
            status: true,
            assignTo: true,
            assignments: {
              select: {
                id: true,
                status: true,
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

  console.log(users)

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

const getAllAgentIds = async () => {
  const agents = await prisma.agent.findMany({
    where: {
      assignTo: {
        isSet: false, // means assignTo is not set OR null
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

  if (!agents || agents.length === 0) {
    throw new ApiError(status.NOT_FOUND, "No unassigned agents found!");
  }

  return agents;
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

  console.log(filters);
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
            totalCalls: true,
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
            assignments: {
              where: {
                status: AssignmentStatus.APPROVED, // Only show approved assignments
              },
              select: {
                id: true,
                status: true,
                assignedAt: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    industry: true,
                  },
                },
              },
              orderBy: {
                assignedAt: "desc",
              },
              take: 1, // Only get the most recent approved assignment
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

  // Calculate average rating for each agent using the fetched feedbacks
  const usersWithAvgRating = users.map((user) => {
    // Safe access to nested properties with optional chaining and fallbacks
    const agent = user.Agent;
    const feedbacks = agent?.AgentFeedbacks || [];
    const assignments = agent?.assignments || [];

    // Calculate average rating
    const totalRating = feedbacks.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    // Get the latest assignment
    const latestAssignment = assignments.length > 0 ? assignments[0] : null;

    return {
      ...user,
      Agent: {
        id: agent?.id || null,
        skills: agent?.skills || [],
        totalCalls: agent?.totalCalls || 0,
        successCalls: agent?.successCalls || 0,
        droppedCalls: agent?.droppedCalls || 0,
        isAvailable: agent?.isAvailable ?? false,
        status: agent?.status || null,
        AgentFeedbacks: feedbacks,
        assignments: assignments,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalFeedbacks: feedbacks.length,
        latestAssignment: latestAssignment,
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
const requestAgentAssignment = async (agentId: string, user: User) => {
  // Validate agent exists
  const agent = await prisma.agent.findUnique({
    where: { userId: agentId },
    include: { user: true },
  });

  if (!agent) {
    throw new ApiError(status.NOT_FOUND, "Agent not found!");
  }

  // Validate organization exists and user owns it
  const organization = await prisma.organization.findUnique({
    where: { ownerId: user.id },
  });

  if (!organization) {
    throw new ApiError(status.NOT_FOUND, "Organization not found!");
  }

  // // Check if agent already has a pending or approved assignment to this organization
  // const existingAssignment = await prisma.agentAssignment.findFirst({
  //   where: {
  //     agentId: agentId,
  //     organizationId: organization.id,
  //     status: { in: [AssignmentStatus.PENDING, AssignmentStatus.APPROVED] },
  //   },
  // });

  // if (existingAssignment) {
  //   if (existingAssignment.status === "APPROVED") {
  //     throw new ApiError(
  //       status.BAD_REQUEST,
  //       "Agent is already assigned to your organization!"
  //     );
  //   }
  //   if (existingAssignment.status === "PENDING") {
  //     throw new ApiError(
  //       status.BAD_REQUEST,
  //       "Assignment request already pending!"
  //     );
  //   }
  // }

  // Check if agent already has an active assignment
  const activeAssignment = await prisma.agentAssignment.findFirst({
    where: {
      agentId: agentId,
      status: AssignmentStatus.APPROVED,
    },
  });

  if (activeAssignment) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Agent already has an active assignment to another organization!"
    );
  }

  // Create assignment request
  const assignment = await prisma.agentAssignment.create({
    data: {
      agentId: agentId,
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

  return {
    ...assignment,
    message: "Assignment request submitted. Waiting for admin approval.",
  };
};

// Approve assignment (Admin only)
const approveAssignment = async (assignmentId: string) => {
  // console.log(assignmentId);
  // const assignment = await prisma.agentAssignment.findUnique({
  //   where: { id: assignmentId },
  //   include: {
  //     agent: true,
  //   },
  // });

  // // console.log("assignment", assignment);

  // if (!assignment) {
  //   throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
  // }

  // if (assignment.status !== AssignmentStatus.PENDING) {
  //   throw new ApiError(
  //     status.BAD_REQUEST,
  //     "Assignment is not in pending status!"
  //   );
  // }

  const assignment = await prisma.agentAssignment.findUnique({
    where: { id: assignmentId },
    include: { agent: true },
  });

  if (!assignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
  }

  // Check if agent already has an active assignment
  const activeAssignment = await prisma.agentAssignment.findFirst({
    where: {
      agentId: assignment.agentId,
      status: AssignmentStatus.APPROVED,
      id: { not: assignmentId },
    },
  });

  if (activeAssignment) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Agent already has an active assignment to another organization!"
    );
  }

  // Update the assignment status to APPROVED
  const updatedAssignment = await prisma.agentAssignment.update({
    where: { id: assignmentId },
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
    },
  });

  // Also update the agent's assignTo field
  await prisma.agent.update({
    where: { userId: assignment.agentId },
    data: {
      assignTo: assignment?.organizationId,
      isAvailable: true,
    },
  });

  return {
    ...updatedAssignment,
    message: "Agent assignment approved successfully!",
  };
};

// Reject assignment (Admin only)
const rejectAssignment = async (assignmentId: string) => {
  const assignment = await prisma.agentAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      agent: true,
      organization: true,
    },
  });

  if (!assignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
  }

  if (assignment.status !== AssignmentStatus.PENDING) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Assignment is not in pending status!"
    );
  }

  // Update the assignment status to REJECTED
  const updatedAssignment = await prisma.agentAssignment.update({
    where: { id: assignmentId },
    data: {
      status: AssignmentStatus.REJECTED,
      rejectedAt: new Date(),
      // reason: reason,
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

  // For rejection: Only remove organization assignment if this was the current one
  if (assignment.agent.assignTo === assignment.organizationId) {
    await prisma.agent.update({
      where: { userId: assignment.agentId },
      data: {
        assignTo: null,
        isAvailable: true,
      },
    });
  }

  return updatedAssignment;
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
const getAgentAssignmentStatus = async (agentId: string) => {
  const assignments = await prisma.agentAssignment.findMany({
    where: {
      agentId: agentId,
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
    where: { userId: agentId },
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

// Organization admin requests agent removal to super admin
const requestAgentRemoval = async (agentId: string, user: User) => {
  // Validate agent exists
  const agent = await prisma.agent.findUnique({
    where: { userId: agentId },
    include: {
      user: true,
    },
  });

  if (!agent) {
    throw new ApiError(status.NOT_FOUND, "Agent not found!");
  }

  // Validate organization exists and user owns it
  const organization = await prisma.organization.findUnique({
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
  const existingAssignment = await prisma.agentAssignment.findFirst({
    where: {
      agentId: agentId,
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
  const updatedAssignment = await prisma.agentAssignment.update({
    where: { id: existingAssignment.id },
    data: {
      status: AssignmentStatus.REMOVAL_REQUESTED,
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

  return updatedAssignment;
};

// Super admin approves removal request
const approveAgentRemoval = async (assignmentId: string) => {
  const assignment = await prisma.agentAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      agent: true,
      organization: true,
    },
  });

  if (!assignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment not found!");
  }

  if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Assignment is not in removal requested status!"
    );
  }

  // Update assignment status to REJECTED (final removal)
  const updatedAssignment = await prisma.agentAssignment.update({
    where: { id: assignmentId },
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
    },
  });

  // Remove agent from organization
  await prisma.agent.update({
    where: { userId: assignment.agentId },
    data: {
      assignTo: null,
      isAvailable: true,
    },
  });

  return updatedAssignment;
};

// Super admin rejects removal request
const rejectAgentRemoval = async (assignmentId: string, reason?: string) => {
  const assignment = await prisma.agentAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      agent: true,
      organization: true,
    },
  });

  if (!assignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment not found!");
  }

  if (assignment.status !== AssignmentStatus.REMOVAL_REQUESTED) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Assignment is not in removal requested status!"
    );
  }

  // Revert back to APPROVED status
  const updatedAssignment = await prisma.agentAssignment.update({
    where: { id: assignmentId },
    data: {
      status: AssignmentStatus.APPROVED,
      rejectedAt: null,
      reason: reason || "Removal request rejected by super admin",
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
    },
  });

  return updatedAssignment;
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
        totalCalls: request.agent.totalCalls || 0,
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

export const AssignmentService = {
  requestAgentAssignment,
  approveAgentRemoval,
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
// const requestAgentAssignment = async (agentId: string, user: User) => {
//   // Validate agent exists
//   const agent = await prisma.agent.findUnique({
//     where: { userId: agentId },
//     include: { user: true },
//   });

//   if (!agent) {
//     throw new ApiError(status.NOT_FOUND, "Agent not found!");
//   }

//   // Check if agent already has an active assignment
//   const activeAssignment = await prisma.agentAssignment.findFirst({
//     where: {
//       agentId: agentId,
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
//       agentId: agentId,
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
//       agentId: agentId,
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
//       agentId: assignment.agentId,
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
//     where: { userId: assignment.agentId },
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
//       where: { userId: assignment.agentId },
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
// const getAgentAssignmentStatus = async (agentId: string) => {
//   const assignments = await prisma.agentAssignment.findMany({
//     where: {
//       agentId: agentId,
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
//     where: { userId: agentId },
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

// const getAllAgentIds = async () => {
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
// const requestAgentRemoval = async (agentId: string, user: User) => {
//   // Validate agent exists
//   const agent = await prisma.agent.findUnique({
//     where: { userId: agentId },
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
//       agentId: agentId,
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
//     where: { userId: assignment.agentId },
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
//   getAllAgentIds,
//   getApprovalRemovalRequestsForSuperAdmin,
//   getAllAgentForAdmin,
//   approveAssignment,
//   rejectAssignment,
//   getPendingAssignments,
//   getAgentAssignmentStatus,
//   getOrganizationAssignments,
// };
