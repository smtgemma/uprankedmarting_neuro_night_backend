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

  // Average call times
  avgHumanCallTime: number;
  avgAICallTime: number;
  avgTotalCallTime: number;

  // Monthly report
  monthlyReport: MonthlyCallData[];
}

export interface MonthlyCallData {
  month: string;
  successCalls: number;
  totalCalls: number;
  aiCalls: number;
  humanCalls: number;
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

const getDashboardStats = async (user: User): Promise<DashboardStats> => {
  try {
    // Get organization ID for the user
    const organization = await prisma.organization.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found for this user");
    }

    const organizationId = organization.id;

    // Get current date for today's calculations
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Convert to Unix timestamp for AI calls
    const startOfTodayUnix = Math.floor(startOfToday.getTime() / 1000);
    const endOfTodayUnix = Math.floor(endOfToday.getTime() / 1000);

    // Execute all queries in parallel for efficiency
    const [
      totalHumanCalls,
      totalAICalls,
      todayHumanCalls,
      todayHumanSuccessCalls,
      todayAiSuccessCalls,
      totalHumanSuccessCalls,
      totalAISuccessCalls,
      humanCallDurationStats,
      aiCallDurationStats,
    ] = await Promise.all([
      // Total Human Calls (all statuses)
      prisma.call.count({ where: { organizationId } }),

      // Total AI Calls (all statuses)
      prisma.aicalllogs.count({
        where: { aiagents: { organizationId } },
      }),

      // Today's Human Calls (all statuses)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
        },
      }),

      // Today's human agent Success Calls (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
          call_status: HUMAN_CALL_STATUS.COMPLETED,
        },
      }),

      // Today's AI Success Calls (COMPLETED only)
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          start_time_unix_secs: { gte: startOfTodayUnix, lte: endOfTodayUnix },
        },
      }),

      // Total Human agent Success Calls (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUS.COMPLETED,
        },
      }),

      // Total AI Success Calls (COMPLETED only)
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
        },
      }),

      // Human Call Duration Stats (for average)
      prisma.call.aggregate({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUS.COMPLETED,
          call_duration: { not: null },
        },
        _avg: { call_duration: true },
        _count: { call_duration: true },
      }),

      // AI Call Duration Stats (for average)
      prisma.aicalllogs.aggregate({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          call_duration_secs: { not: null },
        },
        _avg: { call_duration_secs: true },
        _count: { call_duration_secs: true },
      }),
    ]);

    // Calculate metrics
    const todayTotalSuccessCalls = todayHumanSuccessCalls + todayAiSuccessCalls;
    const totalSuccessCalls = totalHumanSuccessCalls + totalAISuccessCalls;

    const avgHumanCallTime = humanCallDurationStats._avg.call_duration || 0;
    const avgAICallTime = aiCallDurationStats._avg.call_duration_secs || 0;

    // Calculate weighted average for total call time
    const totalHumanDuration = avgHumanCallTime * (humanCallDurationStats._count.call_duration || 0);
    const totalAIDuration = avgAICallTime * (aiCallDurationStats._count.call_duration_secs || 0);
    const totalCallsWithDuration = 
      (humanCallDurationStats._count.call_duration || 0) + 
      (aiCallDurationStats._count.call_duration_secs || 0);

    const avgTotalCallTime = totalCallsWithDuration > 0
      ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
      : 0;

    // Monthly Report
    const monthlyReport = await getMonthlyCallData(organizationId, 6);

    return {
      totalCalls: totalHumanCalls + totalAICalls,
      totalHumanCalls,
      totalAICalls,
      todayHumanCalls,
      todaySuccessCalls: todayTotalSuccessCalls,
      totalSuccessCalls,
      avgHumanCallTime: Math.round(avgHumanCallTime),
      avgAICallTime: Math.round(avgAICallTime),
      avgTotalCallTime: Math.round(avgTotalCallTime),
      monthlyReport,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch dashboard statistics"
    );
  }
};

const getMonthlyCallData = async (organizationId: string, months: number = 6): Promise<MonthlyCallData[]> => {
  const monthlyData: MonthlyCallData[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    // Convert to Unix timestamp for AI calls
    const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
    const monthEndUnix = Math.floor(monthEnd.getTime() / 1000);

    const [humanCalls, aiCalls] = await Promise.all([
      // Human calls for the month (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: monthStart, lte: monthEnd },
          call_status: HUMAN_CALL_STATUS.COMPLETED,
        },
      }),

      // AI calls for the month (COMPLETED only)
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUS.COMPLETED,
          start_time_unix_secs: { gte: monthStartUnix, lte: monthEndUnix },
        },
      })
    ]);

    const successCalls = humanCalls + aiCalls;

    monthlyData.push({
      month: monthNames[date.getMonth()],
      successCalls,
      totalCalls: successCalls, // Since we're only counting completed calls
      aiCalls,
      humanCalls,
    });
  }

  return monthlyData;
};

export const DashboardServices = {
  getDashboardStats,
  getMonthlyCallData,
};