import { AgentFeedback, AssignmentStatus, User, UserRole } from "@prisma/client";
import QueryBuilder from "../../../builder/QueryBuilder";
import prisma from "../../../utils/prisma";
import AppError from "../../../errors/AppError";
import status from "http-status";

const createAgentFeedback = async (
  data: { rating: number; feedbackText?: string },
  userId: string,
  agentUserId: string
) => {
  // Step 1: Prevent duplicate feedback
  const existingFeedback = await prisma.agentFeedback.findFirst({
    where: { agentUserId, clientId: userId },
  });

  if (existingFeedback) {
    throw new AppError(status.BAD_REQUEST, "You have already given feedback for this agent.");
  }

  // Step 2: Check if the agent is assigned to the user's organization
  const org = await prisma.organization.findFirst({
    where: { ownerId: userId },
    include: {
      AgentAssignment: {
        where: {
          agentUserId,
          status: AssignmentStatus.ASSIGNED,
        },
        select: { agentUserId: true },
      },
    },
  });

  if (!org) {
    throw new AppError(status.BAD_REQUEST, "No organization found for this user.");
  }

  const isAgentAssigned = org.AgentAssignment.length > 0;

  if (!isAgentAssigned) {
    throw new AppError(status.BAD_REQUEST, "This agent is not assigned to your organization.");
  }

  // Step 3: Create feedback
  const feedback = await prisma.agentFeedback.create({
    data: {
      rating: data.rating,
      feedbackText: data.feedbackText,
      agentUserId,
      clientId: userId,
    },
  });

  return feedback;
};


const getAllAgentFeedbacks = async (
  query: Record<string, unknown>,
  user: User
) => {
  // console.log("Query:4353")
  const agentFeedbackQuery = new QueryBuilder(prisma.agentFeedback, query)
    .search(["feedbackText"])
    .include({
      client: { select: { id: true, name: true, email: true, image: true } },
    })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await agentFeedbackQuery.execute();
  const meta = await agentFeedbackQuery.countTotal();

  // Get rating statistics for ALL agent feedbacks (not filtered by specific agent)
  const ratingStats = await prisma.agentFeedback.groupBy({
    by: ["rating"],
    _count: {
      rating: true,
    },
  });

  let totalRatings = 0;
  let totalScore = 0;
  const ratingDistribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  ratingStats.forEach((stat) => {
    const rating = stat.rating;
    const count = stat._count.rating;
    if (rating >= 1 && rating <= 5) {
      ratingDistribution[rating] = count;
      totalRatings += count;
      totalScore += rating * count;
    }
  });

  const averageRating = totalRatings > 0 ? totalScore / totalRatings : 0;
  const ratingInPercentage = (averageRating / 5) * 100;

  // 🔹 Percentages for progress bars
  const ratingPercentages = {
    1: totalRatings > 0 ? (ratingDistribution[1] / totalRatings) * 100 : 0,
    2: totalRatings > 0 ? (ratingDistribution[2] / totalRatings) * 100 : 0,
    3: totalRatings > 0 ? (ratingDistribution[3] / totalRatings) * 100 : 0,
    4: totalRatings > 0 ? (ratingDistribution[4] / totalRatings) * 100 : 0,
    5: totalRatings > 0 ? (ratingDistribution[5] / totalRatings) * 100 : 0,
  };

  return {
    meta,
    data: result,
    ratingStats: {
      averageRating: parseFloat(averageRating.toFixed(1)), // ⭐ 4.8
      ratingInPercentage: parseFloat(ratingInPercentage.toFixed(2)), // 96.00%
      totalRatings, // 2005
      ratingDistribution, // {1: x, 2: y, ...}
      ratingPercentages, // {1: %, 2: %, ...}
    },
  };
};

const getSingleAgentFeedback = async (id: string) => {
  const result = await prisma.agentFeedback.findFirst({
    where: { id },
    include: {
      agent: {
        select: {
          id: true,
          skills: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(status.NOT_FOUND, "Agent feedback not found!");
  }
  return result;
};

const updateAgentFeedback = async (
  id: string,
  data: { rating?: number; feedbackText?: string },
  userId: string
): Promise<AgentFeedback> => {
  const checkAgentFeedback = await prisma.agentFeedback.findUnique({
    where: { id },
  });

  if (!checkAgentFeedback) {
    throw new AppError(status.NOT_FOUND, "Agent feedback not found!");
  }

  const result = await prisma.agentFeedback.update({
    where: { id },
    data: {
      rating: data.rating,
      feedbackText: data.feedbackText,
    },
  });
  return result;
};

const deleteAgentFeedback = async (id: string, user: User) => {
  let checkAgentFeedback = null;

  if (user?.role === UserRole.super_admin) {
    checkAgentFeedback = await prisma.agentFeedback.findUnique({
      where: { id },
    });
  } else if (user?.role === UserRole.organization_admin) {
    checkAgentFeedback = await prisma.agentFeedback.findFirst({
      where: {
        id,
        clientId: user.id,
      },
    });
  }

  if (!checkAgentFeedback) {
    throw new AppError(status.NOT_FOUND, "Agent feedback not found");
  }

  return prisma.agentFeedback.delete({
    where: { id },
  });
};

const getAgentFeedbacksByClient = async (
  query: Record<string, unknown>,
  userId: string
) => {
  const agentFeedbackQuery = new QueryBuilder(prisma.agentFeedback, query)
    .search(["feedbackText"])
    .rawFilter({ clientId: userId })
    .sort()
    .paginate()
    .fields();

  const result = await agentFeedbackQuery.execute();
  const meta = await agentFeedbackQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getAgentFeedbacksByRating = async (
  rating: number,
  query: Record<string, unknown>
) => {
  const agentFeedbackQuery = new QueryBuilder(prisma.agentFeedback, query)
    .rawFilter({ rating })
    .sort()
    .paginate()
    .fields();

  const result = await agentFeedbackQuery.execute();
  const meta = await agentFeedbackQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

export const AgentFeedbackServices = {
  createAgentFeedback,
  getAllAgentFeedbacks,
  getSingleAgentFeedback,
  updateAgentFeedback,
  deleteAgentFeedback,
  getAgentFeedbacksByClient,
  getAgentFeedbacksByRating,
};
