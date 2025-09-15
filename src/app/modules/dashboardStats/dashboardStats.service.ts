// // src/app/modules/dashboard/dashboard.service.ts
// import { PrismaClient } from "@prisma/client";
// import { User } from "@prisma/client";
// import status from "http-status";
// import AppError from "../../errors/AppError";

// const prisma = new PrismaClient();

// export interface DashboardStats {
//   // Call counts
//   totalCalls: number;
//   totalHumanCalls: number;
//   totalAICalls: number;
//   todayHumanCalls: number;
//   todaySuccessCalls: number;
//   totalSuccessCalls: number;

//   // Average call times
//   avgHumanCallTime: number;
//   avgAICallTime: number;
//   avgTotalCallTime: number;

//   // Monthly report
//   monthlyReport: MonthlyCallData[];
// }

// export interface MonthlyCallData {
//   month: string;
//   successCalls: number;
//   totalCalls: number;
//   aiCalls: number;
//   humanCalls: number;
// }

// // Status constants
// const HUMAN_CALL_STATUS = {
//   COMPLETED: "completed",
//   CANCELED: "canceled",
//   NO_ANSWER: "no-answer",
//   BUSY: "busy",
//   FAILED: "failed",
//   IN_PROGRESS: "in-progress",
//   RINGING: "ringing",
//   INITIATED: "initiated",
// } as const;

// const AI_CALL_STATUS = {
//   COMPLETED: "completed",
//   IN_PROGRESS: "in-progress",
//   FAILED: "failed",
// } as const;

// const getDashboardStats = async (user: User): Promise<any> => {
//   try {
//     // Get organization ID for the user
//     const organization = await prisma.organization.findFirst({
//       where: { ownerId: user.id },
//       select: { id: true },
//     });

//     if (!organization) {
//       throw new AppError(
//         status.NOT_FOUND,
//         "Organization not found for this user"
//       );
//     }

//     const organizationId = organization.id;

//     // Get current date for today's calculations
//     const startOfToday = new Date();
//     startOfToday.setHours(0, 0, 0, 0);

//     const endOfToday = new Date();
//     endOfToday.setHours(23, 59, 59, 999);

//     // Convert to Unix timestamp for AI calls
//     const startOfTodayUnix = Math.floor(startOfToday.getTime() / 1000);
//     const endOfTodayUnix = Math.floor(endOfToday.getTime() / 1000);

//     // Execute all queries in parallel for efficiency
//     const [
//       totalHumanAgentCalls,
//       totalHumanAgentSuccessCalls,
//       todayHumanAgentCalls,
//       todayHumanAgentSuccessCalls,

//       totalAIAgentCalls,
//       totalAIAgentSuccessCalls,
//       todayAIAgentCalls,
//       todayAIAgentSuccessCalls,

//       humanCallDurationStats,
//       aiCallDurationStats,
//     ] = await Promise.all([
//       // Human calls
//       prisma.call.count({ where: { organizationId } }),
//       prisma.call.count({
//         where: { organizationId, call_status: HUMAN_CALL_STATUS.COMPLETED },
//       }),
//       prisma.call.count({
//         where: {
//           organizationId,
//           call_time: { gte: startOfToday, lte: endOfToday },
//         },
//       }),
//       prisma.call.count({
//         where: {
//           organizationId,
//           call_time: { gte: startOfToday, lte: endOfToday },
//           call_status: HUMAN_CALL_STATUS.COMPLETED,
//         },
//       }),

//       // AI calls
//       prisma.aicalllogs.count({
//         where: { aiagents: { organizationId } },
//       }),
//       prisma.aicalllogs.count({
//         where: {
//           aiagents: { organizationId },
//           status: AI_CALL_STATUS.COMPLETED,
//         },
//       }),
//       prisma.aicalllogs.count({
//         where: {
//           aiagents: { organizationId },
//           start_time_unix_secs: { gte: startOfTodayUnix, lte: endOfTodayUnix },
//         },
//       }),
//       prisma.aicalllogs.count({
//         where: {
//           aiagents: { organizationId },
//           status: AI_CALL_STATUS.COMPLETED,
//           start_time_unix_secs: { gte: startOfTodayUnix, lte: endOfTodayUnix },
//         },
//       }),

//       // Aggregations
//       prisma.call.aggregate({
//         where: {
//           organizationId,
//           call_status: HUMAN_CALL_STATUS.COMPLETED,
//           recording_duration: { not: null },
//         },
//         _avg: { recording_duration: true },
//         _count: { recording_duration: true },
//       }),
//       prisma.aicalllogs.aggregate({
//         where: {
//           aiagents: { organizationId },
//           status: AI_CALL_STATUS.COMPLETED,
//           call_duration_secs: { not: null },
//         },
//         _avg: { call_duration_secs: true },
//         _count: { call_duration_secs: true },
//       }),
//     ]);

//     // Calculate metrics
//     const todayTotalSuccessCalls =
//       todayHumanAgentSuccessCalls + todayAIAgentSuccessCalls;
//     const totalSuccessCalls =
//       totalHumanAgentSuccessCalls + totalAIAgentSuccessCalls;

//     const avgHumanCallTime =
//       humanCallDurationStats._avg.recording_duration || 0;
//     const avgAICallTime = aiCallDurationStats._avg.call_duration_secs || 0;

//     // Weighted average total
//     const totalHumanDuration =
//       avgHumanCallTime *
//       (humanCallDurationStats._count.recording_duration || 0);
//     const totalAIDuration =
//       avgAICallTime * (aiCallDurationStats._count.call_duration_secs || 0);
//     const totalCallsWithDuration =
//       (humanCallDurationStats._count.recording_duration || 0) +
//       (aiCallDurationStats._count.call_duration_secs || 0);

//     const avgTotalCallTime =
//       totalCallsWithDuration > 0
//         ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
//         : 0;

//     // Monthly Report
//     // Monthly Report - use provided parameters or defaults
//     const monthlyReport = await getMonthlyCallData(
//       organizationId,
//       6,
//       new Date().getFullYear()
//     );

//     return {
//       totalCalls: totalHumanAgentCalls + totalAIAgentCalls,
//       totalHumanCalls: totalHumanAgentCalls,
//       totalAICalls: totalAIAgentCalls,
//       totalSuccessCalls,
//       todayHumanCalls: todayHumanAgentCalls,
//       todayAICalls: todayAIAgentCalls,
//       todaySuccessCalls: todayTotalSuccessCalls,
//       avgHumanCallTime: Math.round(avgHumanCallTime),
//       avgAICallTime: Math.round(avgAICallTime),
//       avgTotalCallTime: Math.round(avgTotalCallTime),
//       monthlyReport,
//     };
//   } catch (error) {
//     console.error("Error fetching dashboard stats:", error);
//     throw new AppError(
//       status.INTERNAL_SERVER_ERROR,
//       "Failed to fetch dashboard statistics"
//     );
//   }
// };



// const getMonthlyCallData = async (
//   organizationId: string,
//   months: number = 6,
//   year?: number
// ): Promise<MonthlyCallData[]> => {
//   const monthlyData: MonthlyCallData[] = [];
//   const monthNames = [
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sep",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];

//   const currentDate = new Date();
//   const currentYear = currentDate.getFullYear();
//   const targetYear = year || currentYear;

//   for (let i = months - 1; i >= 0; i--) {
//     try {
//       const date = new Date(targetYear, currentDate.getMonth() - i, 1);

//       // If we're looking at future months, skip them
//       if (date > currentDate) {
//         continue;
//       }

//       const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
//       const monthEnd = new Date(
//         date.getFullYear(),
//         date.getMonth() + 1,
//         0,
//         23,
//         59,
//         59,
//         999
//       );

//       // Don't process future months
//       if (monthStart > currentDate) {
//         continue;
//       }

//       // Adjust end date if it's in the future
//       const effectiveMonthEnd = monthEnd > currentDate ? currentDate : monthEnd;

//       // Convert to Unix timestamp for AI calls
//       const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
//       const monthEndUnix = Math.floor(effectiveMonthEnd.getTime() / 1000);

//       const [humanCalls, aiCalls] = await Promise.all([
//         // Human calls for the month (COMPLETED only)
//         prisma.call.count({
//           where: {
//             organizationId,
//             call_time: { gte: monthStart, lte: effectiveMonthEnd },
//             call_status: HUMAN_CALL_STATUS.COMPLETED,
//           },
//         }),

//         // AI calls for the month (COMPLETED only)
//         prisma.aicalllogs.count({
//           where: {
//             aiagents: { organizationId },
//             status: AI_CALL_STATUS.COMPLETED,
//             start_time_unix_secs: { gte: monthStartUnix, lte: monthEndUnix },
//           },
//         }),
//       ]);

//       const successCalls = humanCalls + aiCalls;

//       monthlyData.push({
//         month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
//         successCalls,
//         totalCalls: successCalls,
//         aiCalls,
//         humanCalls,
//       });
//     } catch (error) {
//       console.error(`Error processing month ${i}:`, error);
//       // Continue with other months even if one fails
//     }
//   }

//   // If no data was found, return fallback data
//   if (monthlyData.length === 0) {
//     return getFallbackMonthlyData(months, targetYear);
//   }

//   return monthlyData;
// };

// // Fallback function when no data is available
// const getFallbackMonthlyData = (
//   months: number,
//   year: number
// ): MonthlyCallData[] => {
//   const monthlyData: MonthlyCallData[] = [];
//   const monthNames = [
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sep",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];

//   const currentDate = new Date();

//   for (let i = months - 1; i >= 0; i--) {
//     const date = new Date(year, currentDate.getMonth() - i, 1);

//     // Skip future months
//     if (date > currentDate) {
//       continue;
//     }

//     monthlyData.push({
//       month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
//       successCalls: 0,
//       totalCalls: 0,
//       aiCalls: 0,
//       humanCalls: 0,
//     });
//   }

//   return monthlyData;
// };

// export const DashboardServices = {
//   getDashboardStats,
//   getMonthlyCallData,
// };


// src/app/modules/dashboard/dashboard.service.ts
import { PrismaClient } from "@prisma/client";
import { User } from "@prisma/client";
import status from "http-status";
import AppError from "../../errors/AppError";

const prisma = new PrismaClient();

export interface DashboardStats {
  // Call counts
  totalCalls: number;
  totalHumanCalls: number;
  totalAICalls: number;
  todayHumanCalls: number;
  todaySuccessCalls: number;
  totalSuccessCalls: number;

  // Call duration statistics
  callDurationStats: {
    minCallDuration: number;
    maxCallDuration: number;
    avgCallDuration: number;
    minAICallDuration: number;
    maxAICallDuration: number;
    avgAICallDuration: number;
    minHumanCallDuration: number;
    maxHumanCallDuration: number;
    avgHumanCallDuration: number;
  };

  // Monthly report
  monthlyReport: MonthlyCallData[];
}

export interface MonthlyCallData {
  month: string;
  successCalls: number;
  totalCalls: number;
  aiCalls: number;
  humanCalls: number;
  humanTotalCallDuration: number; // in seconds
  aiTotalCallDuration: number;    // in seconds
}

// Status constants
const HUMAN_CALL_STATUS = {
  COMPLETED: "completed",
  CANCELED: "canceled",
  NO_ANSWER: "no-answer",
  BUSY: "busy",
  FAILED: "failed",
  IN_PROGRESS: "in-progress",
  RINGING: "ringing",
  INITIATED: "initiated",
} as const;

const AI_CALL_STATUS = {
  COMPLETED: "completed",
  IN_PROGRESS: "in-progress",
  FAILED: "failed",
} as const;

const getDashboardStats = async (user: User, query: Record<string, unknown>): Promise<any> => {
  try {
    const queryMonth = Number(query?.month) || 12;  
    const queryYear = Number(query?.year) || new Date().getFullYear();
    // Get organization ID for the user
    const organization = await prisma.organization.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });

    if (!organization) {
      throw new AppError(
        status.NOT_FOUND,
        "Organization not found for this user"
      );
    }

    const organizationId = organization.id;

    // Get current date for today's calculations
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Convert to Unix timestamp for AI calls
    const startOfTodayUnix = Math.floor(startOfToday.getTime() / 1000);
    const endOfTodayUnix = Math.floor(endOfToday.getTime() / 1000);

    // Execute all queries in parallel for efficiency
    const [
      totalHumanAgentCalls,
      totalHumanAgentSuccessCalls,
      todayHumanAgentCalls,
      todayHumanAgentSuccessCalls,

      totalAIAgentCalls,
      totalAIAgentSuccessCalls,
      todayAIAgentCalls,
      todayAIAgentSuccessCalls,

      humanCallDurationStats,
      aiCallDurationStats,
      humanCallMinMax,
      aiCallMinMax,
    ] = await Promise.all([
      // Human calls
      prisma.call.count({ where: { organizationId } }),
      prisma.call.count({
        where: { organizationId, call_status: HUMAN_CALL_STATUS.COMPLETED },
      }),
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
          call_status: HUMAN_CALL_STATUS.COMPLETED,
        },
      }),

      // AI calls
      prisma.aicalllogs.count({
        where: { aiagents: { organizationId } },
      }),
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
        },
      }),
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          start_time_unix_secs: { gte: startOfTodayUnix, lte: endOfTodayUnix },
        },
      }),
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          start_time_unix_secs: { gte: startOfTodayUnix, lte: endOfTodayUnix },
        },
      }),

      // Human call duration aggregations
      prisma.call.aggregate({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUS.COMPLETED,
          recording_duration: { not: null },
        },
        _avg: { recording_duration: true },
        _count: { recording_duration: true },
      }),
      
      // AI call duration aggregations
      prisma.aicalllogs.aggregate({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          call_duration_secs: { not: null },
        },
        _avg: { call_duration_secs: true },
        _count: { call_duration_secs: true },
      }),
      
      // Human call min/max duration
      prisma.call.findMany({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUS.COMPLETED,
          recording_duration: { not: null },
        },
        orderBy: { recording_duration: 'asc' },
        take: 1,
        select: { recording_duration: true }
      }).then(results => results[0]?.recording_duration || 0),
      
      // AI call min/max duration
      prisma.aicalllogs.findMany({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          call_duration_secs: { not: null },
        },
        orderBy: { call_duration_secs: 'asc' },
        take: 1,
        select: { call_duration_secs: true }
      }).then(results => results[0]?.call_duration_secs || 0),
      
      // Human call max duration
      prisma.call.findMany({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUS.COMPLETED,
          recording_duration: { not: null },
        },
        orderBy: { recording_duration: 'desc' },
        take: 1,
        select: { recording_duration: true }
      }).then(results => results[0]?.recording_duration || 0),
      
      // AI call max duration
      prisma.aicalllogs.findMany({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          call_duration_secs: { not: null },
        },
        orderBy: { call_duration_secs: 'desc' },
        take: 1,
        select: { call_duration_secs: true }
      }).then(results => results[0]?.call_duration_secs || 0),
    ]);

    // Calculate metrics
    const todayTotalSuccessCalls =
      todayHumanAgentSuccessCalls + todayAIAgentSuccessCalls;
    const totalSuccessCalls =
      totalHumanAgentSuccessCalls + totalAIAgentSuccessCalls;

    const avgHumanCallTime = humanCallDurationStats._avg.recording_duration || 0;
    const avgAICallTime = aiCallDurationStats._avg.call_duration_secs || 0;

    // Calculate overall average call time
    const totalHumanDuration =
      avgHumanCallTime * (humanCallDurationStats._count.recording_duration || 0);
    const totalAIDuration =
      avgAICallTime * (aiCallDurationStats._count.call_duration_secs || 0);
    const totalCallsWithDuration =
      (humanCallDurationStats._count.recording_duration || 0) +
      (aiCallDurationStats._count.call_duration_secs || 0);

    const avgTotalCallTime =
      totalCallsWithDuration > 0
        ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
        : 0;

    // Monthly Report
    const monthlyReport = await getMonthlyCallData(organizationId, queryMonth, queryYear);
    
    // Get call duration statistics
    const callDurationStats = getCallDurationStats(monthlyReport);

    return {
      totalCalls: totalHumanAgentCalls + totalAIAgentCalls,
      totalHumanCalls: totalHumanAgentCalls,
      totalAICalls: totalAIAgentCalls,
      totalSuccessCalls,
      todayHumanCalls: todayHumanAgentCalls,
      todayAICalls: todayAIAgentCalls,
      todaySuccessCalls: todayTotalSuccessCalls,
       monthlyReport,
       callDurationStats
      // callDurationStats: {
      //   totalHumanDuration: callDurationStats.totalHumanDuration,
      //   totalAIDuration: callDurationStats.totalAIDuration,
      //   maxHumanDuration: callDurationStats.maxHumanDuration,
      //   maxAIDuration: callDurationStats.maxAIDuration,
      //   minHumanDuration: callDurationStats.minHumanDuration,
      //   minAIDuration: callDurationStats.minAIDuration,
      //   avgHumanDuration: Math.round(callDurationStats.avgHumanDuration),
      //   avgAIDuration: Math.round(callDurationStats.avgAIDuration),
      // },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch dashboard statistics"
    );
  }
};



const getMonthlyCallData = async (
  organizationId: string,
  months: number = 6,
  year?: number
): Promise<MonthlyCallData[]> => {
  const monthlyData: MonthlyCallData[] = [];
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const targetYear = year || currentYear;

  for (let i = months - 1; i >= 0; i--) {
    try {
      // target month বের করা
      const date = new Date(targetYear, currentDate.getMonth() - i, 1);

      // future মাস skip করো
      if (date > currentDate) continue;

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      // যদি monthEnd future হয় → currentDate পর্যন্ত নাও
      const effectiveMonthEnd = monthEnd > currentDate ? currentDate : monthEnd;

      // Unix timestamps AI calls এর জন্য
      const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
      const monthEndUnix = Math.floor(effectiveMonthEnd.getTime() / 1000);

      // parallel query run
      const [humanCalls, aiCalls, humanCallDuration, aiCallDuration] =
        await Promise.all([
          // Human completed calls
          prisma.call.count({
            where: {
              organizationId,
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: HUMAN_CALL_STATUS.COMPLETED,
            },
          }),

          // AI completed calls
          prisma.aicalllogs.count({
            where: {
              aiagents: { organizationId },
              status: AI_CALL_STATUS.COMPLETED,
              start_time_unix_secs: { gte: monthStartUnix, lte: monthEndUnix },
            },
          }),

          // Human call total duration
          prisma.call.aggregate({
            where: {
              organizationId,
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: HUMAN_CALL_STATUS.COMPLETED,
              recording_duration: { not: null },
            },
            _sum: { recording_duration: true },
          }),

          // AI call total duration
          prisma.aicalllogs.aggregate({
            where: {
              aiagents: { organizationId },
              status: AI_CALL_STATUS.COMPLETED,
              start_time_unix_secs: { gte: monthStartUnix, lte: monthEndUnix },
              call_duration_secs: { not: null },
            },
            _sum: { call_duration_secs: true },
          }),
        ]);

        console.log("Human Calls:", humanCalls, "AI Calls:", aiCalls)
      const successCalls = humanCalls + aiCalls;

      monthlyData.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        successCalls,
        totalCalls: successCalls, // এখানে তুমি চাইলে আলাদা total logic বসাতে পারো
        aiCalls,
        humanCalls,
        humanTotalCallDuration: humanCallDuration._sum.recording_duration || 0,
        aiTotalCallDuration: aiCallDuration._sum.call_duration_secs || 0,
      });
    } catch (error) {
      console.error(`Error processing month ${i}:`, error);
      // Skip করে পরের মাসে যাও
    }
  }

  // fallback → কোনো data না পেলে
  if (monthlyData.length === 0) {
    return getFallbackMonthlyData(months, targetYear);
  }

  return monthlyData;
};


const getFallbackMonthlyData = (
  months: number,
  year: number
): MonthlyCallData[] => {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const currentDate = new Date();

  return Array.from({ length: months }, (_, i) => {
    const date = new Date(year, currentDate.getMonth() - i, 1);
    return {
      month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      successCalls: 0,
      totalCalls: 0,
      aiCalls: 0,
      humanCalls: 0,
      humanTotalCallDuration: 0,
      aiTotalCallDuration: 0,
    };
  }).reverse();
};


// Function to get call duration statistics for the chart
const getCallDurationStats = (monthlyReport: MonthlyCallData[]) => {
  let totalHumanDuration = 0;
  let totalAIDuration = 0;
  let maxHumanDuration = 0;
  let maxAIDuration = 0;

  monthlyReport.forEach(month => {
    totalHumanDuration += month.humanTotalCallDuration;
    totalAIDuration += month.aiTotalCallDuration;

    if (month.humanTotalCallDuration > maxHumanDuration) {
      maxHumanDuration = month.humanTotalCallDuration;
    }
    if (month.aiTotalCallDuration > maxAIDuration) {
      maxAIDuration = month.aiTotalCallDuration;
    }
  });

  // max value বের করো
  const largestValue = Math.max(maxHumanDuration, maxAIDuration);

  // ticks generate করো
  const ticks = generateTicks(largestValue);

  return {
    totalHumanDuration,
    totalAIDuration,
    maxHumanDuration,
    maxAIDuration,
    largestValue,
    ticks, // ✅ Chart এ এইটা use করতে পারবে
  };
};

// utils/ticks.ts
export const generateTicks = (maxValue: number): number[] => {
  if (maxValue <= 0) return [0];

  // Step নির্ধারণ করা হবে maxValue এর scale অনুযায়ী
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  let step = magnitude;

  if (maxValue / step < 2) {
    step = step / 5;
  } else if (maxValue / step < 5) {
    step = step / 2;
  }

  const ticks = [];
  for (let i = 0; i <= maxValue + step; i += step) {
    ticks.push(i);
  }

  return ticks;
};


export const DashboardServices = {
  getDashboardStats,
  getMonthlyCallData,
};