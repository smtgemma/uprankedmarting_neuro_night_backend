// import status from "http-status";
// import QueryBuilder from "../../builder/QueryBuilder";
// import AppError from "../../errors/AppError";
// import prisma from "../../utils/prisma";
// import { AssignmentStatus, User, UserRole } from "@prisma/client";

// const getAllAgentFromDB = async (query: Record<string, unknown>) => {
//   const userQuery = new QueryBuilder(prisma.user, query)
//     .search(["name", "email"])
//     .filter()
//     .rawFilter({
//       isDeleted: false,
//       role: "agent",
//     })
//     // Add agent availability filtering
//     .rawFilter(query.isAvailable ? {
//       Agent: {
//         isAvailable: query.isAvailable === 'true' || query.isAvailable === true
//       }
//     } : {})
//     .sort()
//     .include({
//       Agent: true,
//     })
//     .paginate();

//   const [result, meta] = await Promise.all([
//     userQuery.execute(),
//     userQuery.countTotal(),
//   ]);

//   if (!result.length) {
//     throw new AppError(status.NOT_FOUND, "No agents found!");
//   }

//   const data = result.map((user: User) => {
//     const { password, ...rest } = user;
//     return rest;
//   });

//   return {
//     meta,
//     data,
//   };
// };

// const getAgentsByOrganizationFromDB = async (
//   organizationId: string,
//   query: Record<string, unknown>
// ) => {
//   // Validate if organization exists
//   const organization = await prisma.organization.findUnique({
//     where: { id: organizationId },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found!");
//   }

//   const agentQuery = new QueryBuilder(prisma.user, query)
//     .search(["name", "email"])
//     .filter()
//     .rawFilter({
//       isDeleted: false,
//       role: "agent",
//       Agent: {
//         assignTo: organizationId,
//       },
//     })
//     .sort()
//     .include({
//       Agent: true,
//     })
//     .paginate();

//   const [result, meta] = await Promise.all([
//     agentQuery.execute(),
//     agentQuery.countTotal(),
//   ]);

//   if (!result.length) {
//     throw new AppError(
//       status.NOT_FOUND,
//       "No agents found for this organization!"
//     );
//   }

//   const data = result.map((user: User) => {
//     const { password, ...rest } = user;
//     return rest;
//   });

//   return {
//     meta,
//     data,
//   };
// };

// const getAvailableAgentsFromDB = async (query: Record<string, unknown>) => {
//   const agentQuery = new QueryBuilder(prisma.user, query)
//     .search(["name", "email"])
//     .filter()
//     .rawFilter({
//       isDeleted: false,
//       role: "agent",
//       Agent: {
//         isAvailable: true,
//       },
//     })
//     .sort()
//     .include({
//       Agent: true,
//     })
//     .paginate();

//   const [result, meta] = await Promise.all([
//     agentQuery.execute(),
//     agentQuery.countTotal(),
//   ]);

//   if (!result.length) {
//     throw new AppError(status.NOT_FOUND, "No available agents found!");
//   }

//   const data = result.map((user: User) => {
//     const { password, ...rest } = user;
//     return rest;
//   });

//   return {
//     meta,
//     data,
//   };
// };

// const getAgentByIdFromDB = async (agentId: string) => {
//   const agent = await prisma.user.findUnique({
//     where: {
//       id: agentId,
//       isDeleted: false,
//       role: "agent",
//     },
//     include: {
//       Agent: {
//         include: {
//           organization: true,
//           AgentFeedbacks: true,
//           calls: true,
//         },
//       },
//     },
//   });

//   if (!agent) {
//     throw new AppError(status.NOT_FOUND, "Agent not found!");
//   }

//   const { password, ...agentData } = agent;
//   return agentData;
// };

// // const assignAgentToOrganization = async (agentId: string, user: User) => {
// //   // Validate agent exists and is an agent
// //   const agent = await prisma.user.findUnique({
// //     where: {
// //       id: agentId,
// //       isDeleted: false,
// //       role: "agent",
// //     },
// //     include: { Agent: true },
// //   });

// //   if (!agent) {
// //     throw new AppError(status.NOT_FOUND, "Agent not found!");
// //   }

// //   // Validate organization exists
// //   const organization = await prisma.organization.findUnique({
// //     where: { ownerId: user?.id },
// //   });

// //   if (!organization) {
// //     throw new AppError(status.NOT_FOUND, "Organization not found!");
// //   }

// //   if (user.role !== UserRole.super_admin) {
// //     if (organization.ownerId !== user.id) {
// //       throw new AppError(
// //         status.UNAUTHORIZED,
// //         "You are not authorized to assign agents to this organization!"
// //       );
// //     }
// //   }

// //   // Update agent assignment
// //   const updatedAgent = await prisma.agent.update({
// //     where: { userId: agentId },
// //     data: {
// //       assignTo: organization.id,
// //       isAvailable: false,
// //     },
// //     include: {
// //       user: {
// //         select: {
// //           id: true,
// //           name: true,
// //           email: true,
// //           role: true,
// //         },
// //       },
// //       organization: true,
// //     },
// //   });

// //   return updatedAgent;
// // };

// const unassignAgentFromOrganization = async (agentId: string, user: User) => {
//   // Validate agent exists and is an agent
//   const agent = await prisma.user.findUnique({
//     where: {
//       id: agentId,
//       isDeleted: false,
//       role: "agent",
//     },
//     include: { Agent: true },
//   });

//   if (!agent) {
//     throw new AppError(status.NOT_FOUND, "Agent not found!");
//   }

//   // Validate organization exists
//   const organization = await prisma.organization.findUnique({
//     where: { ownerId: user?.id },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found!");
//   }

//   if (user.role !== UserRole.super_admin) {
//     if (organization.ownerId !== user.id) {
//       throw new AppError(
//         status.UNAUTHORIZED,
//         "You are not authorized to assign agents to this organization!"
//       );
//     }
//   }
//   // Remove assignment
//   const updatedAgent = await prisma.agent.update({
//     where: { userId: agentId },
//     data: {
//       assignTo: null,
//       isAvailable: true,
//     },
//     include: {
//       user: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//           role: true,
//         },
//       },
//     },
//   });

//   return updatedAgent;
// };

// //
// const assignAgentToOrganization = async (agentId: string, user: User) => {
//   // Validate agent exists and is an agent
//   const agent = await prisma.user.findUnique({
//     where: {
//       id: agentId,
//       isDeleted: false,
//       role: "agent",
//     },
//     include: { Agent: true },
//   });

//   if (!agent) {
//     throw new AppError(status.NOT_FOUND, "Agent not found!");
//   }

//   // Validate organization exists
//   const organization = await prisma.organization.findUnique({
//     where: { ownerId: user?.id },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found!");
//   }

//   if (user.role !== UserRole.super_admin) {
//     if (organization.ownerId !== user.id) {
//       throw new AppError(
//         status.UNAUTHORIZED,
//         "You are not authorized to assign agents to this organization!"
//       );
//     }
//   }

//   // Check if agent is already assigned to this organization
//   if (agent.Agent?.assignTo === organization.id) {
//     throw new AppError(
//       status.BAD_REQUEST,
//       "Agent is already assigned to this organization!"
//     );
//   }

//   // Update agent assignment with PENDING status
//   const updatedAgent = await prisma.agent.update({
//     where: { userId: agentId },
//     data: {
//       assignTo: organization.id,
//       assignmentStatus: AssignmentStatus.PENDING, // Set status to pending
//       isAvailable: false, // Make agent unavailable until approved
//     },
//     include: {
//       user: {
//         select: {
//           id: true,
//           name: true,
//           email: true,
//           role: true,
//         },
//       },
//       organization: true,
//     },
//   });

//   return updatedAgent;
// };

// export const AgentServices = {
//   getAllAgentFromDB,
//   getAgentsByOrganizationFromDB,
//   getAvailableAgentsFromDB,
//   getAgentByIdFromDB,
//   assignAgentToOrganization,
//   unassignAgentFromOrganization,
// };

// services/assignment.service.ts
import { PrismaClient, AssignmentStatus, UserRole, User } from "@prisma/client";
import ApiError from "../../errors/AppError";
import status from "http-status";
import {
  IPaginationOptions,
  paginationHelper,
} from "../../utils/paginationHelpers";
import AppError from "../../errors/AppError";

const prisma = new PrismaClient();

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
    // Unassigned = assignTo is null OR field missing
    whereClause.Agent = {
      OR: [
        { assignTo: null }, // null হলে
        { assignTo: { isSet: false } }, // field missing হলে (Prisma syntax)
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

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    users,
  };
};

const getAllAgentForAdmin = async (
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
            // assignments: {
            //   select: {
            //     status: true,
            //     assignedAt: true,
            //     organization: {
            //       select: {
            //         name: true,
            //       },
            //     },
            //   },
            //   orderBy: {
            //     assignedAt: 'desc',
            //   },
            //   take: 1,
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

  // Check if agent already has a pending or approved assignment to this organization
  const existingAssignment = await prisma.agentAssignment.findFirst({
    where: {
      agentId: agentId,
      organizationId: organization.id,
      status: { in: [AssignmentStatus.PENDING, AssignmentStatus.APPROVED] },
    },
  });

  if (existingAssignment) {
    if (existingAssignment.status === "APPROVED") {
      throw new ApiError(
        status.BAD_REQUEST,
        "Agent is already assigned to your organization!"
      );
    }
    if (existingAssignment.status === "PENDING") {
      throw new ApiError(
        status.BAD_REQUEST,
        "Assignment request already pending!"
      );
    }
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
  console.log(assignmentId);
  const assignment = await prisma.agentAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      agent: true,
    },
  });

  // console.log("assignment", assignment);

  if (!assignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment request not found!");
  }

  if (assignment.status !== AssignmentStatus.PENDING) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Assignment is not in pending status!"
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

const getAllAgentIds = async () => {
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
    },
  });

  if (!agents) {
    throw new ApiError(status.NOT_FOUND, "Agents not found!");
  }
  return agents;
};

export const AssignmentService = {
  requestAgentAssignment,
  getAllAgentFromDB,
  getAllAgentIds,
  getAllAgentForAdmin,
  approveAssignment,
  rejectAssignment,
  getPendingAssignments,
  getAgentAssignmentStatus,
  getOrganizationAssignments,
};
