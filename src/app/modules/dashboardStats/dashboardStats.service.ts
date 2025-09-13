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

// Status mapping
const HUMAN_CALL_STATUSES = {
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  NO_ANSWER: "NO_ANSWER",
  BUSY: "BUSY",
  FAILED: "FAILED",
  IN_PROGRESS: "IN_PROGRESS",
  RINGING: "RINGING",
  INITIATED: "INITIATED",
};

const AI_CALL_STATUSES = {
  COMPLETED: "completed",
  IN_PROGRESS: "in-progress",
  FAILED: "failed",
};

const getDashboardStats = async (user: User): Promise<any> => {
  try {
    // Get organization ID for the user
    const organization = await prisma.organization.findFirst({
      where: {
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new AppError(
        status.NOT_FOUND,
        "Organization not found for this user"
      );
    }

    const organizationId = organization.id;

    // Get current date for today's calculations
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Execute all queries in parallel for efficiency
    const [
      totalHumanCalls,
      totalAICalls,
      todayHumanCalls,
      todayHumanSuccessCalls,
      todayAiSuccessCalls,
      totalSuccessCalls,
      humanCallDurationStats,
      aiCallDurationStats,
    ] = await Promise.all([
      // 1. Total Human Calls (all statuses)
      prisma.call.count({
        where: { organizationId },
      }),

      // 2. Total AI Calls (all statuses)
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
        },
      }),

      // 3. Today's Human Calls (all statuses)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
        },
      }),

      // 4. Today's human agent Success Calls (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: startOfToday, lte: endOfToday },
          call_status: HUMAN_CALL_STATUSES.COMPLETED,
        },
      }),
     // 5. Today's AI Success Calls (COMPLETED only)
      prisma.aicalllogs.count({
        where: {
          aiagents: {
            organizationId: organizationId, // filter by organization
          },
          status: AI_CALL_STATUSES.COMPLETED, // only completed calls
          start_time_unix_secs: {
            gte: Math.floor(startOfToday.getTime() / 1000), // convert to Unix seconds
            lte: Math.floor(endOfToday.getTime() / 1000),
          },
        },
      }),

      // 6. Total Success Calls (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUSES.COMPLETED,
        },
      }),

      // 7. Human Call Duration Stats (for average)
      prisma.call.aggregate({
        where: {
          organizationId,
          call_status: HUMAN_CALL_STATUSES.COMPLETED,
          call_duration: { not: null },
        },
        _avg: { call_duration: true },
        _count: { call_duration: true },
      }),

      // 8. AI Call Duration Stats (for average)
      prisma.aicalllogs.aggregate({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUSES.COMPLETED,
          call_duration_secs: { not: null },
        },
        _avg: { call_duration_secs: true },
        _count: { call_duration_secs: true },
      }),
    ]);

    // Calculate average call times
    const avgHumanCallTime = humanCallDurationStats._avg.call_duration || 0;
    const avgAICallTime = aiCallDurationStats._avg.call_duration_secs || 0;

    // Calculate weighted average for total call time
    const totalHumanDuration =
      (humanCallDurationStats._avg.call_duration || 0) *
      (humanCallDurationStats._count.call_duration || 0);
    const totalAIDuration =
      (aiCallDurationStats._avg.call_duration_secs || 0) *
      (aiCallDurationStats._count.call_duration_secs || 0);
    const totalCallsWithDuration =
      (humanCallDurationStats._count.call_duration || 0) +
      (aiCallDurationStats._count.call_duration_secs || 0);

    const avgTotalCallTime =
      totalCallsWithDuration > 0
        ? (totalHumanDuration + totalAIDuration) / totalCallsWithDuration
        : 0;

    // 8. Monthly Report
    const monthlyReport = await getMonthlyCallData(organizationId, 6);

    return {
      totalCalls: totalHumanCalls + totalAICalls,
      totalHumanCalls,
      totalAICalls,
      todayHumanCalls,
      todaySuccessCalls:{
        human: todayHumanSuccessCalls,
        ai: todayAiSuccessCalls
      },
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

const getMonthlyCallData = async (
  organizationId: string,
  months: number = 6
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

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
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

    // Execute both queries in parallel
    const [humanCalls, aiCalls] = await Promise.all([
      // Human calls for the month (COMPLETED only)
      prisma.call.count({
        where: {
          organizationId,
          call_time: { gte: monthStart, lte: monthEnd },
          call_status: HUMAN_CALL_STATUSES.COMPLETED,
        },
      }),

      // AI calls for the month (COMPLETED only)
      prisma.aicalllogs.count({
        where: {
          aiagents: { organizationId },
          status: AI_CALL_STATUSES.COMPLETED,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    const successCalls = humanCalls + aiCalls;
    const totalCalls = humanCalls + aiCalls;

    monthlyData.push({
      month: monthNames[date.getMonth()],
      successCalls,
      totalCalls,
      aiCalls,
      humanCalls,
    });
  }

  return monthlyData;
};

// Additional function to get call status breakdown
const getCallStatusBreakdown = async (organizationId: string) => {
  const [humanStatuses, aiStatuses] = await Promise.all([
    prisma.call.groupBy({
      by: ["call_status"],
      where: { organizationId },
      _count: { id: true },
    }),
    prisma.aicalllogs.groupBy({
      by: ["status"],
      where: {
        aiagents: { organizationId },
      },
      _count: { id: true },
    }),
  ]);

  return {
    human: humanStatuses,
    ai: aiStatuses,
  };
};

export const DashboardServices = {
  getDashboardStats,
  getMonthlyCallData,
  getCallStatusBreakdown,
};
