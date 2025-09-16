import status from "http-status";
// import QueryBuilder from "../../builder/QueryBuilder";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import {
  IPaginationOptions,
  paginationHelper,
} from "../../utils/paginationHelpers";
import { User } from "@prisma/client";

const getAllOrganizations = async () => {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      industry: true,
      organizationNumber: true,
      ownerId: true,
      subscriptions: {
        select: {
          id: true,
          amount: true,
          startDate: true,
          endDate: true,
          paymentStatus: true,
          planLevel: true,
          purchasedNumber: true,
          sid: true,
          numberOfAgents: true,
          status: true,
          plan: {
            select: {
              id: true,
              planName: true,
            },
          },
        },
      },
    },
  });

  return { data: organizations };
};

const getSingleOrganization = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    // include: {

    // }
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found");
  }

  return organization;
};

// const getOrganizationCallLogsManagement = async (
//   options: IPaginationOptions,
//   filters: any = {},
//   user: User
// ) => {
//   let searchTerm = filters?.searchTerm as string;

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);

//   const getOrganizationAdmin = await prisma.organization.findUnique({
//     where: {
//       ownerId: user?.id,
//     },
//   });

//   if (!getOrganizationAdmin) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }
//   // console.log(getOrganizationAdmin);
//   // Build where clause for Call model
//   let whereClause: any = {
//     organizationId: getOrganizationAdmin?.id,
//   };

//   // console.log(whereClause, 450);

//   // If search term exists, ADD search conditions to the existing whereClause
//   if (searchTerm) {
//     whereClause.AND = [
//       {
//         OR: [
//           { from_number: { contains: searchTerm, mode: "insensitive" } },
//           { to_number: { contains: searchTerm, mode: "insensitive" } },
//           { call_status: { contains: searchTerm, mode: "insensitive" } },
//           { callType: { contains: searchTerm, mode: "insensitive" } },
//           {
//             receivedBy: {
//               user: {
//                 name: { contains: searchTerm, mode: "insensitive" },
//               },
//             },
//           },
//         ],
//       },
//     ];
//   }
//   // console.log(whereClause);

//   const [calls, total] = await Promise.all([
//     prisma.call.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         organizationId: true,
//         agentId: true,
//         from_number: true,
//         to_number: true,
//         call_time: true,
//         callType: true,
//         call_status: true,
//         call_duration: true,
//         call_started_at: true,
//         call_completed_at: true,
//         call_transcript: true,
//         recording_duration: true,
//         recording_status: true,
//         recording_url: true,
//         receivedBy: {
//           select: {
//             id: true,
//             droppedCalls: true,
//             successCalls: true,
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
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
//     prisma.call.count({
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
//     data: calls,
//   };
// };

const getPlatformOverviewStats = async (): Promise<any> => {
  try {
    // Execute all queries in parallel for efficiency
    const [totalOrganizations, totalHumanCalls, totalAICalls] =
      await Promise.all([
        // Total organizations count
        prisma.organization.count(),

        // Total human calls (all statuses)
        prisma.call.count(),

        // Total AI calls (all statuses)
        prisma.aicalllogs.count(),
      ]);

    const totalCalls = totalHumanCalls + totalAICalls;

    return {
      totalOrganizations,
      totalCalls,
      totalHumanCalls,
      totalAICalls,
    };
  } catch (error) {
    console.error("Error fetching platform overview stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch platform overview statistics"
    );
  }
};

const getOrganizationCallLogsManagement = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  let searchTerm = filters?.searchTerm as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const getOrganizationAdmin = await prisma.organization.findUnique({
    where: {
      ownerId: user?.id,
    },
  });

  if (!getOrganizationAdmin) {
    throw new AppError(status.NOT_FOUND, "Organization not found");
  }

  // Get both human calls and AI call logs in parallel
  const [humanCalls, aiCallLogs, totalHumanCalls, totalAICallLogs] =
    await Promise.all([
      // Human agent calls
      getHumanAgentCalls(
        getOrganizationAdmin.id,
        searchTerm,
        skip,
        limit,
        sortBy,
        sortOrder
      ),

      // AI agent call logs
      getAIAgentCallLogs(
        getOrganizationAdmin.id,
        searchTerm,
        skip,
        limit,
        sortBy,
        sortOrder
      ),

      // Total counts for pagination
      prisma.call.count({
        where: {
          organizationId: getOrganizationAdmin.id,
          ...(searchTerm && {
            OR: [
              { from_number: { contains: searchTerm, mode: "insensitive" } },
              { to_number: { contains: searchTerm, mode: "insensitive" } },
              { call_status: { contains: searchTerm, mode: "insensitive" } },
              { callType: { contains: searchTerm, mode: "insensitive" } },
            ],
          }),
        },
      }),

      prisma.aicalllogs.count({
        where: {
          aiagents: {
            organizationId: getOrganizationAdmin.id,
          },
          ...(searchTerm && {
            OR: [
              { agent_name: { contains: searchTerm, mode: "insensitive" } },
              {
                conversation_id: { contains: searchTerm, mode: "insensitive" },
              },
              { status: { contains: searchTerm, mode: "insensitive" } },
              { direction: { contains: searchTerm, mode: "insensitive" } },
            ],
          }),
        },
      }),
    ]);

  // Combine and format the data
  const combinedData = [
    ...humanCalls.map((call) => ({
      type: "human" as const,
      id: call.id,
      agent_id: call.agentId,
      agent_name: call.receivedBy?.user?.name || "Unknown Agent",
      from_number: call.from_number,
      to_number: call.to_number,
      call_time: call.call_time,
      call_duration: call.call_duration,
      call_status: call.call_status,
      callType: call.callType,
      recording_url: call.recording_url,
      createdAt: call.createdAt,
    })),
    ...aiCallLogs.map((log) => ({
      type: "ai" as const,
      id: log.id,
      agent_id: log.agent_id,
      agent_name: log.agent_name || "AI Agent",
      from_number: null,
      to_number: null,
      // conversation_id: log.conversation_id,
      // message_count: log.message_count,
      call_time: log.start_time_unix_secs,
      call_duration: log.call_duration_secs,
      call_status: log.status,
      call_successful: log.call_successful,
      callType: log.direction,
      createdAt: log.createdAt,
    })),
  ];

  // Sort combined data (optional)
  combinedData.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  const total = totalHumanCalls + totalAICallLogs;

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      humanCalls: totalHumanCalls,
      aiCallLogs: totalAICallLogs,
    },
    data: combinedData,
  };
};

// Helper function for human agent calls
const getHumanAgentCalls = async (
  organizationId: string,
  searchTerm: string,
  skip: number,
  limit: number,
  sortBy: string,
  sortOrder: string
) => {
  let whereClause: any = {
    organizationId: organizationId,
  };

  if (searchTerm) {
    whereClause.OR = [
      { from_number: { contains: searchTerm, mode: "insensitive" } },
      { to_number: { contains: searchTerm, mode: "insensitive" } },
      { call_status: { contains: searchTerm, mode: "insensitive" } },
      { callType: { contains: searchTerm, mode: "insensitive" } },
      {
        receivedBy: {
          user: {
            name: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
    ];
  }

  return prisma.call.findMany({
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
      createdAt: true,
      receivedBy: {
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
      },
    },
    orderBy: {
      [sortBy as string]: sortOrder,
    },
    skip: Number(skip),
    take: Number(limit),
  });
};

// Helper function for AI agent call logs
const getAIAgentCallLogs = async (
  organizationId: string,
  searchTerm: string,
  skip: number,
  limit: number,
  sortBy: string,
  sortOrder: string
) => {
  let whereClause: any = {
    aiagents: {
      organizationId: organizationId,
    },
  };

  if (searchTerm) {
    whereClause.OR = [
      { agent_name: { contains: searchTerm, mode: "insensitive" } },
      { conversation_id: { contains: searchTerm, mode: "insensitive" } },
      { status: { contains: searchTerm, mode: "insensitive" } },
      { direction: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  return prisma.aicalllogs.findMany({
    where: whereClause,
    select: {
      id: true,
      agent_id: true,
      agent_name: true,
      conversation_id: true,
      start_time_unix_secs: true,
      call_duration_secs: true,
      message_count: true,
      status: true,
      call_successful: true,
      direction: true,
      createdAt: true,
    },
    orderBy: {
      [sortBy as string]: sortOrder,
    },
    skip: Number(skip),
    take: Number(limit),
  });
};

export const OrganizationServices = {
  getAllOrganizations,
  getPlatformOverviewStats,
  getOrganizationCallLogsManagement,
  getSingleOrganization,
};
