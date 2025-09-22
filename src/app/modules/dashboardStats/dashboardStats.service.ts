
// src/app/modules/dashboard/dashboard.service.ts
import { PrismaClient } from "@prisma/client";
import { User } from "@prisma/client";
import status from "http-status";
import AppError from "../../errors/AppError";
import { MonthlyCallData } from "./dashboardStats.interface";
import prisma from "../../utils/prisma";

// Status constants (updated for current schema)
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
  CANCELED: "canceled",
  NO_ANSWER: "no-answer",
  BUSY: "busy",
  FAILED: "failed",
  IN_PROGRESS: "in-progress",
  RINGING: "ringing",
  INITIATED: "initiated",
} as const;

const getFallbackMonthlyData = (
  months: number,
  year: number
): MonthlyCallData[] => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
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

export const generateTicks = (maxValue: number): number[] => {
  if (maxValue <= 0) return [0];

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

// Organization Admin Dashboard Stats with query parameters
const getOrganizationAdminDashboardStats = async (
  user: User,
  query: Record<string, unknown>
): Promise<any> => {
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
      aiCallDurationStats
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

      // AI calls - using new schema fields
      prisma.aICallLog.count({
        where: { organizationId },
      }),
      prisma.aICallLog.count({
        where: {
          organizationId,
          call_status: AI_CALL_STATUS.COMPLETED,
        },
      }),
      prisma.aICallLog.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.aICallLog.count({
        where: {
          organizationId,
          call_status: AI_CALL_STATUS.COMPLETED,
          call_time: { gte: startOfToday, lte: endOfToday },
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

      // AI call duration aggregations - using new schema fields
      prisma.aICallLog.aggregate({
        where: {
          organizationId,
          call_status: AI_CALL_STATUS.COMPLETED,
          call_duration: { not: null },
        },
        _avg: { call_duration: true },
        _count: { call_duration: true },
      }),

      // Human call min duration
      // prisma.call
      //   .findFirst({
      //     where: {
      //       organizationId,
      //       call_status: HUMAN_CALL_STATUS.COMPLETED,
      //       recording_duration: { not: null },
      //     },
      //     orderBy: { recording_duration: "asc" },
      //     select: { recording_duration: true },
      //   })
      //   .then((result) => result?.recording_duration || 0),

      // // AI call min duration
      // prisma.aICallLog
      //   .findFirst({
      //     where: {
      //       organizationId,
      //       call_status: AI_CALL_STATUS.COMPLETED,
      //       call_duration: { not: null },
      //     },
      //     orderBy: { call_duration: "asc" },
      //     select: { call_duration: true },
      //   })
      //   .then((result) => result?.call_duration || 0),

      // // Human call max duration
      // prisma.call
      //   .findFirst({
      //     where: {
      //       organizationId,
      //       call_status: HUMAN_CALL_STATUS.COMPLETED,
      //       recording_duration: { not: null },
      //     },
      //     orderBy: { recording_duration: "desc" },
      //     select: { recording_duration: true },
      //   })
      //   .then((result) => result?.recording_duration || 0),

      // // AI call max duration
      // prisma.aICallLog
      //   .findFirst({
      //     where: {
      //       organizationId,
      //       call_status: AI_CALL_STATUS.COMPLETED,
      //       call_duration: { not: null },
      //     },
      //     orderBy: { call_duration: "desc" },
      //     select: { call_duration: true },
      //   })
      //   .then((result) => result?.call_duration || 0),

    ]);

    // Calculate metrics
    const todayTotalSuccessCalls =
      todayHumanAgentSuccessCalls + todayAIAgentSuccessCalls;
    const totalSuccessCalls =
      totalHumanAgentSuccessCalls + totalAIAgentSuccessCalls;

    const avgHumanCallTime = humanCallDurationStats._avg.recording_duration || 0;
    const avgAICallTime = aiCallDurationStats._avg.call_duration || 0;

    // Calculate overall average call time
    const totalHumanDuration =
      avgHumanCallTime * (humanCallDurationStats._count.recording_duration || 0);
    const totalAIDuration =
      avgAICallTime * (aiCallDurationStats._count.call_duration || 0);
    const totalCallsWithDuration =
      (humanCallDurationStats._count.recording_duration || 0) +
      (aiCallDurationStats._count.call_duration || 0);

    const avgTotalCallTime =
      totalCallsWithDuration > 0
        ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
        : 0;

    // Monthly Report
    const monthlyReport = await getOrganizationAdminMonthlyCallData(
      organizationId,
      queryMonth,
      queryYear
    );
    return {
      totalCalls: totalHumanAgentCalls + totalAIAgentCalls,
      totalHumanCalls: totalHumanAgentCalls,
      totalAICalls: totalAIAgentCalls,
      totalSuccessCalls,
      todayHumanCalls: todayHumanAgentCalls,
      todayAICalls: todayAIAgentCalls,
      todaySuccessCalls: todayTotalSuccessCalls,
      monthlyReport,
      callTiming: {
        avgTotalCallTime,
        avgAICallTime,
        avgHumanCallTime
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch dashboard statistics"
    );
  }
};

const getOrganizationAdminMonthlyCallData = async (
  organizationId: string,
  months: number = 12,
  year?: number
): Promise<MonthlyCallData[]> => {
  const monthlyData: MonthlyCallData[] = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const targetYear = year || currentYear;

  for (let i = months - 1; i >= 0; i--) {
    try {
      const date = new Date(targetYear, currentDate.getMonth() - i, 1);
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

      const effectiveMonthEnd = monthEnd > currentDate ? currentDate : monthEnd;

      const [totalHumanCalls,humanCalls,totalAICalls, aiCalls, humanCallDuration, aiCallDuration] =
        await Promise.all([
          // Human all calls - all organizations
          prisma.call.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
            },
          }),
          // Human completed calls
          prisma.call.count({
            where: {
              organizationId,
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: HUMAN_CALL_STATUS.COMPLETED,
            },
          }),
           // AI all calls - all organizations
          prisma.aICallLog.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
            },
          }),

          // AI completed calls - using new schema
          prisma.aICallLog.count({
            where: {
              organizationId,
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: AI_CALL_STATUS.COMPLETED,
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

          // AI call total duration - using new schema
          prisma.aICallLog.aggregate({
            where: {
              organizationId,
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: AI_CALL_STATUS.COMPLETED,
              call_duration: { not: null },
            },
            _sum: { call_duration: true },
          }),
        ]);

       const successCalls = humanCalls + aiCalls;
      const totalCalls = totalHumanCalls + totalAICalls;

      monthlyData.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        successCalls,
        totalCalls: totalCalls,
        aiCalls,
        humanCalls,
        humanTotalCallDuration: humanCallDuration._sum.recording_duration || 0,
        aiTotalCallDuration: aiCallDuration._sum.call_duration || 0,
      });
    } catch (error) {
      console.error(`Error processing month ${i}:`, error);
    }
  }

  if (monthlyData.length === 0) {
    return getFallbackMonthlyData(months, targetYear);
  }

  return monthlyData;
};

// Super admin Dashboard Stats
const getAdminDashboardStats = async (
  query: Record<string, unknown>
): Promise<any> => {
  try {
    const queryMonth = Number(query?.month) || 12;
    const queryYear = Number(query?.year) || new Date().getFullYear();

    // Get current date for today's calculations
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Execute all queries in parallel for efficiency (no organization filters)
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
      // humanCallMinDuration,
      // aiCallMinDuration
    ] = await Promise.all([
      // Human calls - all organizations
      prisma.call.count(),
      prisma.call.count({
        where: { call_status: HUMAN_CALL_STATUS.COMPLETED },
      }),
      prisma.call.count({
        where: { call_time: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.call.count({
        where: {
          call_time: { gte: startOfToday, lte: endOfToday },
          call_status: HUMAN_CALL_STATUS.COMPLETED,
        },
      }),

      // AI calls - all organizations
      prisma.aICallLog.count(),
      prisma.aICallLog.count({
        where: { call_status: AI_CALL_STATUS.COMPLETED },
      }),
      prisma.aICallLog.count({
        where: { call_time: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.aICallLog.count({
        where: {
          call_time: { gte: startOfToday, lte: endOfToday },
          call_status: AI_CALL_STATUS.COMPLETED,
        },
      }),

      // Human call duration aggregations - all organizations
      prisma.call.aggregate({
        where: {
          call_status: HUMAN_CALL_STATUS.COMPLETED,
          recording_duration: { not: null },
        },
        _avg: { recording_duration: true },
        _count: { recording_duration: true },
      }),

      // AI call duration aggregations - all organizations
      prisma.aICallLog.aggregate({
        where: {
          call_status: AI_CALL_STATUS.COMPLETED,
          call_duration: { not: null },
        },
        _avg: { call_duration: true },
        _count: { call_duration: true },
      }),

      // Human call min duration
      prisma.call
        .findFirst({
          where: {
            call_status: HUMAN_CALL_STATUS.COMPLETED,
            recording_duration: { not: null },
          },
          orderBy: { recording_duration: "asc" },
          select: { recording_duration: true },
        })
        .then((result) => result?.recording_duration || 0),

      // AI call min duration
      prisma.aICallLog
        .findFirst({
          where: {
            call_status: AI_CALL_STATUS.COMPLETED,
            call_duration: { not: null },
          },
          orderBy: { call_duration: "asc" },
          select: { call_duration: true },
        })
        .then((result) => result?.call_duration || 0),

      // Human call max duration
      // prisma.call
      //   .findFirst({
      //     where: {
      //       call_status: HUMAN_CALL_STATUS.COMPLETED,
      //       call_duration: { not: null },
      //     },
      //     orderBy: { call_duration: "desc" },
      //     select: { call_duration: true },
      //   })
      //   .then((result) => result?.call_duration || 0),

      // AI call max duration
      // prisma.aICallLog
      //   .findFirst({
      //     where: {
      //       call_status: AI_CALL_STATUS.COMPLETED,
      //       call_duration: { not: null },
      //     },
      //     orderBy: { call_duration: "desc" },
      //     select: { call_duration: true },
      //   })
      //   .then((result) => result?.call_duration || 0),
    ]);

    // Calculate metrics
    const todayTotalSuccessCalls =
      todayHumanAgentSuccessCalls + todayAIAgentSuccessCalls;
    const totalSuccessCalls =
      totalHumanAgentSuccessCalls + totalAIAgentSuccessCalls;

    const avgHumanCallTime = humanCallDurationStats._avg.recording_duration || 0;
    const avgAICallTime = aiCallDurationStats._avg.call_duration || 0;

    // Calculate overall average call time
    const totalHumanDuration =
      avgHumanCallTime * (humanCallDurationStats._count.recording_duration || 0);
    const totalAIDuration =
      avgAICallTime * (aiCallDurationStats._count.call_duration || 0);
    const totalCallsWithDuration =
      (humanCallDurationStats._count.recording_duration || 0) +
      (aiCallDurationStats._count.call_duration || 0);

    const avgTotalCallTime =
      totalCallsWithDuration > 0
        ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
        : 0;

    // Monthly Report - for all organizations
    const monthlyReport = await getAdminMonthlyCallData(queryMonth, queryYear);
    return {
      totalCalls: totalHumanAgentCalls + totalAIAgentCalls,
      totalHumanCalls: totalHumanAgentCalls,
      totalAICalls: totalAIAgentCalls,
      totalSuccessCalls,
      todayHumanCalls: todayHumanAgentCalls,
      todayAICalls: todayAIAgentCalls,
      todaySuccessCalls: todayTotalSuccessCalls,
      monthlyReport,
      callTiming: {
        avgTotalCallTime,
        avgAICallTime,
        avgHumanCallTime
      },
    };
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch admin dashboard statistics"
    );
  }
};

const getAdminMonthlyCallData = async (
  months: number = 12,
  year?: number
): Promise<MonthlyCallData[]> => {
  const monthlyData: MonthlyCallData[] = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const targetYear = year || currentYear;

  for (let i = months - 1; i >= 0; i--) {
    try {
      const date = new Date(targetYear, currentDate.getMonth() - i, 1);
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

      const effectiveMonthEnd = monthEnd > currentDate ? currentDate : monthEnd;

      const [totalHumanCalls, humanCalls,totalAICalls, aiCalls, humanCallDuration, aiCallDuration] =
        await Promise.all([
          // Human all calls - all organizations
          prisma.call.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
            },
          }),
          // Human completed calls - all organizations
          prisma.call.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: HUMAN_CALL_STATUS.COMPLETED,
            },
          }),

          // AI all calls - all organizations
          prisma.aICallLog.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
            },
          }),
          // AI completed calls - all organizations
          prisma.aICallLog.count({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: AI_CALL_STATUS.COMPLETED,
            },
          }),

          // Human call total duration - all organizations
          prisma.call.aggregate({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: HUMAN_CALL_STATUS.COMPLETED,
              recording_duration: { not: null },
            },
            _sum: { recording_duration: true },
          }),

          // AI call total duration - all organizations
          prisma.aICallLog.aggregate({
            where: {
              call_time: { gte: monthStart, lte: effectiveMonthEnd },
              call_status: AI_CALL_STATUS.COMPLETED,
              call_duration: { not: null },
            },
            _sum: { call_duration: true },
          }),
        ]);

      const successCalls = humanCalls + aiCalls;
      const totalCalls = totalHumanCalls + totalAICalls;

      monthlyData.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        successCalls,
        totalCalls: totalCalls,
        aiCalls,
        humanCalls,
        humanTotalCallDuration: humanCallDuration._sum.recording_duration || 0,
        aiTotalCallDuration: aiCallDuration._sum.call_duration || 0,
      });
    } catch (error) {
      console.error(`Error processing month ${i}:`, error);
    }
  }

  if (monthlyData.length === 0) {
    return getFallbackMonthlyData(months, targetYear);
  }

  return monthlyData;
};

export const DashboardServices = {
  getOrganizationAdminDashboardStats,
  getOrganizationAdminMonthlyCallData,
  getAdminDashboardStats,
};
