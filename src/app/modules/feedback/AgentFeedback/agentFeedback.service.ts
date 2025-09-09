import { PrismaClient, AgentFeedback, User, UserRole } from "@prisma/client";
import QueryBuilder from "../../../builder/QueryBuilder";
import prisma from "../../../utils/prisma";
import AppError from "../../../errors/AppError";
import status from "http-status";

const createAgentFeedback = async (
  data: { rating: number; feedbackText?: string },
  userId: string,
  agentId: string
): Promise<AgentFeedback> => {
  // console.log("Agent ID:", agentId , "clientId", userId)
  const checkAgentFeedback = await prisma.agentFeedback.findFirst({
    where: {
      agentId: agentId,
      clientId: userId,
    },
  });

  if (checkAgentFeedback) {
    throw new AppError(status.BAD_REQUEST, "Agent feedback already exists!");
  }

  const checkisAgentAssignToMyOrganization =
    await prisma.organization.findFirst({
      where: {
        ownerId: userId,
      },
      include: {
        agents: {
          select: {
            id: true,
          },
        },
      },
    });

  const isAgentInOrg = checkisAgentAssignToMyOrganization?.agents?.some(
    (agent) => agent.id.toString() === agentId
  );

  if (!isAgentInOrg) {
    console.log("Agent not found in this organization:", agentId);
    throw new AppError(
      status.BAD_REQUEST,
      "Agent is not assigned to your organization!"
    );
  }

  const serviceData = {
    rating: data.rating,
    feedbackText: data.feedbackText || undefined,
    agentId: agentId,
    clientId: userId,
  };

  const result = await prisma.agentFeedback.create({
    data: serviceData,
  });
  return result;
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

  // Calculate total ratings and average for ALL feedbacks
  let totalRatings = 0;
  let totalScore = 0;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  ratingStats.forEach((stat) => {
    const rating = stat.rating;
    const count = stat._count.rating;

    if (rating >= 1 && rating <= 5) {
      ratingDistribution[rating as keyof typeof ratingDistribution] = count;
      totalRatings += count;
      totalScore += rating * count;
    }
  });

  const averageRating = totalRatings > 0 ? totalScore / totalRatings : 0;

  // Calculate percentages
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
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalRatings,
      ratingDistribution,
      ratingPercentages,
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
          gender: true,
          address: true,
          emergencyPhone: true,
          ssn: true,
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
