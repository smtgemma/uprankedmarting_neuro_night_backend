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
          trialStart: true,
          trialEnd: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          canceledAt: true,
          planLevel: true,
          purchasedNumber: true,
          sid: true,
          numberOfAgents: true,
          status: true,
          plan: {
            select: {
              id: true,
              name: true,
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
        prisma.aICallLog.count(),
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

//   // Get both human calls and AI call logs in parallel
//   const [humanCalls, aiCallLogs, totalHumanCalls, totalAICallLogs] =
//     await Promise.all([
//       // Human agent calls
//       getHumanAgentCalls(
//         getOrganizationAdmin.id,
//         searchTerm,
//         skip,
//         limit,
//         sortBy,
//         sortOrder
//       ),

//       // AI agent call logs
//       getAIAgentCallLogs(
//         getOrganizationAdmin.id,
//         searchTerm,
//         skip,
//         limit,
//         sortBy,
//         sortOrder
//       ),

//       // Total counts for pagination
//       prisma.call.count({
//         where: {
//           organizationId: getOrganizationAdmin.id,
//           ...(searchTerm && {
//             OR: [
//               { from_number: { contains: searchTerm, mode: "insensitive" } },
//               { to_number: { contains: searchTerm, mode: "insensitive" } },
//               { call_status: { contains: searchTerm, mode: "insensitive" } },
//               { callType: { contains: searchTerm, mode: "insensitive" } },
//             ],
//           }),
//         },
//       }),

//       prisma.aICallLog.count({
//         where: {
//           aiagents: {
//             organizationId: getOrganizationAdmin.id,
//           },
//           ...(searchTerm && {
//             OR: [
//               // { agent_name: { contains: searchTerm, mode: "insensitive" } },
//               {
//                 conversation_id: { contains: searchTerm, mode: "insensitive" },
//               },
//               // { status: { contains: searchTerm, mode: "insensitive" } },
//               // { direction: { contains: searchTerm, mode: "insensitive" } },
//             ],
//           }),
//         },
//       }),
//     ]);

//   // Combine and format the data
//   const combinedData = [
//     ...humanCalls.map((call) => ({
//       type: "human" as const,
//       id: call.id,
//       agent_id: call?.agentId,
//       agent_name: call?.receivedBy?.user?.name || "Unknown Agent",
//       from_number: call.from_number,
//       to_number: call.to_number,
//       call_time: call.call_time,
//       call_duration: call.call_duration,
//       call_status: call.call_status,
//       callType: call.callType,
//       recording_url: call.recording_url,
//       createdAt: call.createdAt,
//     })),
//     ...aiCallLogs.map((log) => ({
//       type: "ai" as const,
//       id: log.id,
//       agent_id: log?.agent_id,
//       agent_name: log?.agent_name || "AI Agent",
//       from_number: null,
//       to_number: null,
//       recording_url: null,
//       // conversation_id: log.conversation_id,
//       // message_count: log.message_count,
//       call_time: log.start_time_unix_secs,
//       call_duration: log.call_duration_secs,
//       call_status: log.status,
//       call_successful: log.call_successful,
//       callType: log.direction,
//       createdAt: log.createdAt,
//     })),
//   ];

//   // Sort combined data (optional)
//   combinedData.sort((a, b) => {
//     const dateA = new Date(a.createdAt).getTime();
//     const dateB = new Date(b.createdAt).getTime();
//     return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
//   });

//   const total = totalHumanCalls + totalAICallLogs;

//   return {
//     meta: {
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / Number(limit)),
//       humanCalls: totalHumanCalls,
//       aiCallLogs: totalAICallLogs,
//     },
//     data: combinedData,
//   };
// };

// // Helper function for human agent calls
// const getHumanAgentCalls = async (
//   organizationId: string,
//   searchTerm: string,
//   skip: number,
//   limit: number,
//   sortBy: string,
//   sortOrder: string
// ) => {
//   let whereClause: any = {
//     organizationId: organizationId,
//   };

//   if (searchTerm) {
//     whereClause.OR = [
//       { from_number: { contains: searchTerm, mode: "insensitive" } },
//       { to_number: { contains: searchTerm, mode: "insensitive" } },
//       { call_status: { contains: searchTerm, mode: "insensitive" } },
//       { callType: { contains: searchTerm, mode: "insensitive" } },
//       {
//         receivedBy: {
//           user: {
//             name: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//     ];
//   }

//   return prisma.call.findMany({
//     where: whereClause,
//     select: {
//       id: true,
//       organizationId: true,
//       agentId: true,
//       from_number: true,
//       to_number: true,
//       call_time: true,
//       callType: true,
//       call_status: true,
//       call_duration: true,
//       call_started_at: true,
//       call_completed_at: true,
//       recording_duration: true,
//       recording_status: true,
//       recording_url: true,
//       createdAt: true,
//       receivedBy: {
//         select: {
//           id: true,
//           user: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },
//     },
//     orderBy: {
//       [sortBy as string]: sortOrder,
//     },
//     skip: Number(skip),
//     take: Number(limit),
//   });
// };

// // Helper function for AI agent call logs
// const getAIAgentCallLogs = async (
//   organizationId: string,
//   searchTerm: string,
//   skip: number,
//   limit: number,
//   sortBy: string,
//   sortOrder: string
// ) => {
//   let whereClause: any = {
//     aiagents: {
//       organizationId: organizationId,
//     },
//   };

//   if (searchTerm) {
//     whereClause.OR = [
//       { agent_name: { contains: searchTerm, mode: "insensitive" } },
//       { conversation_id: { contains: searchTerm, mode: "insensitive" } },
//       { status: { contains: searchTerm, mode: "insensitive" } },
//       { direction: { contains: searchTerm, mode: "insensitive" } },
//     ];
//   }

//   return prisma.aicalllogs.findMany({
//     where: whereClause,
//     select: {
//       id: true,
//       agent_id: true,
//       agent_name: true,
//       conversation_id: true,
//       start_time_unix_secs: true,
//       call_duration_secs: true,
//       message_count: true,
//       status: true,
//       call_successful: true,
//       direction: true,
//       createdAt: true,
//     },
//     orderBy: {
//       [sortBy as string]: sortOrder,
//     },
//     skip: Number(skip),
//     take: Number(limit),
//   });
// };

const getOrganizationCallLogsManagement = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  let searchTerm = filters?.searchTerm as string;
  let agentType = filters?.agentType as string; // 'ai', 'human', or undefined for both

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

  // Determine which data to fetch based on agentType filter
  const shouldFetchHuman = agentType !== 'ai';
  const shouldFetchAI = agentType !== 'human';

  // Prepare promises for data fetching
  const humanCallsPromise = shouldFetchHuman ?
    getHumanAgentCalls(
      getOrganizationAdmin.id,
      searchTerm,
      skip,
      limit,
      sortBy,
      sortOrder
    ) : Promise.resolve([]);

  const totalHumanCallsPromise = shouldFetchHuman ?
    prisma.call.count({
      where: {
        organizationId: getOrganizationAdmin.id,
        ...(searchTerm && {
          OR: [
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
          ],
        }),
      },
    }) : Promise.resolve(0);

  const aiCallLogsPromise = shouldFetchAI ?
    getAIAgentCallLogs(
      getOrganizationAdmin.id,
      searchTerm,
      skip,
      limit,
      sortBy,
      sortOrder
    ) : Promise.resolve([]);

  const totalAICallLogsPromise = shouldFetchAI ?
    prisma.aICallLog.count({
      where: {
        organizationId: getOrganizationAdmin.id,
        ...(searchTerm && {
          OR: [
            { from_number: { contains: searchTerm, mode: "insensitive" } },
            { to_number: { contains: searchTerm, mode: "insensitive" } },
            { call_status: { contains: searchTerm, mode: "insensitive" } },
            { callType: { contains: searchTerm, mode: "insensitive" } },
            {
              aiagents: {
                agentId: { contains: searchTerm, mode: "insensitive" },
              },
            },
          ],
        }),
      },
    }) : Promise.resolve(0);

  // Execute only the necessary queries
  const [humanCalls, totalHumanCalls, aiCallLogs, totalAICallLogs] = await Promise.all([
    humanCallsPromise,
    totalHumanCallsPromise,
    aiCallLogsPromise,
    totalAICallLogsPromise
  ]);

  // Combine and format the data
  const combinedData = [
    ...(humanCalls.map((call) => ({
      type: "human" as const,
      id: call.id,
      organizationId: call.organizationId,
      call_sid: call.call_sid,
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
    }))),

    ...(aiCallLogs.map((log) => ({
      type: "ai" as const,
      id: log.id,
      conversation_id: log.conversation_id,
      organizationId: log.organizationId,
      call_sid: log.call_sid,
      agent_id: log.agent_id,
      agent_name: null,
      from_number: log.from_number,
      to_number: log.to_number,
      call_time: log.call_time,
      call_duration: log.call_duration,
      call_status: log.call_status,
      callType: log.callType,
      recording_url: null,
      recording_duration: log.recording_duration,
      createdAt: log.createdAt,
    }))),
  ];

  // Sort combined data by createdAt
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
      call_sid: true,
      from_number: true,
      to_number: true,
      call_time: true,
      callType: true,
      call_status: true,
      call_duration: true,
      call_started_at: true,
      call_completed_at: true,
      recording_duration: true,
      recording_status: true,
      recording_url: true,
      recording_sid: true,
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
      [sortBy]: sortOrder,
    },
    skip: skip,
    take: limit,
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
    organizationId: organizationId,
  };

  if (searchTerm) {
    whereClause.OR = [
      { from_number: { contains: searchTerm, mode: "insensitive" } },
      { to_number: { contains: searchTerm, mode: "insensitive" } },
      { call_status: { contains: searchTerm, mode: "insensitive" } },
      { callType: { contains: searchTerm, mode: "insensitive" } },
      {
        aiagents: {
          agentId: { contains: searchTerm, mode: "insensitive" },
        },
      },
    ];
  }

  return prisma.aICallLog.findMany({
    where: whereClause,
    select: {
      id: true,
      call_sid: true,
      organizationId: true,
      agent_id: true,
      conversation_id: true,
      from_number: true,
      to_number: true,
      callType: true,
      call_status: true,
      call_time: true,
      call_started_at: true,
      call_completed_at: true,
      call_duration: true,
      recording_duration: true,
      call_transcript: true,
      createdAt: true,
      updatedAt: true,
      aiagents: {
        select: {
          agentId: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: skip,
    take: limit,
  });
};
export const OrganizationServices = {
  getAllOrganizations,
  getPlatformOverviewStats,
  getOrganizationCallLogsManagement,
  getSingleOrganization,
};
