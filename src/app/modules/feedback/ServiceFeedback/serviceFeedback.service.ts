import { PrismaClient, ServiceFeedback, User, UserRole } from "@prisma/client";
import QueryBuilder from "../../../builder/QueryBuilder";
import prisma from "../../../utils/prisma";
import AppError from "../../../errors/AppError";
import status from "http-status";

const createServiceFeedback = async (
  data: { rating: number; feedbackText?: string },
  userId: string
): Promise<ServiceFeedback> => {
  const checkAgentFeedback = await prisma.serviceFeedback.findFirst({
    where: {
      clientId: userId,
    },
  });

  if (checkAgentFeedback) {
    throw new AppError(status.BAD_REQUEST, "Service feedback already exists!");
  }

  const serviceData = {
    rating: data.rating,
    feedbackText: data.feedbackText || undefined,
    clientId: userId,
  };

  const result = await prisma.serviceFeedback.create({
    data: serviceData,
  });
  return result;
};

const getAllServiceFeedbacks = async (query: Record<string, unknown>) => {
  const serviceFeedbackQuery = new QueryBuilder(prisma.serviceFeedback, query)
    .search(["feedbackText"])
    .include({ client: { select: { id: true, name: true, email: true, image: true } } })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await serviceFeedbackQuery.execute();
  const meta = await serviceFeedbackQuery.countTotal();

  // 🔹 Rating statistics
  const ratingStats = await prisma.serviceFeedback.groupBy({
    by: ["rating"],
    _count: { rating: true },
  });

  let totalRatings = 0;
  let totalScore = 0;
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  ratingStats.forEach(stat => {
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


const getMostValuableServiceFeedbacks = async (
  query: Record<string, unknown>
) => {
  const serviceFeedbackQuery = new QueryBuilder(prisma.serviceFeedback, query)
    .search(["feedbackText"])
    .include({ client: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      }
    } })
    .filter()
    .sort()
    .paginate()
    .fields();

  let result = await serviceFeedbackQuery.execute();

  //  Apply extra condition
  result = result.filter(
    (item: any) =>
      item.rating === 5 && item.feedbackText && item.feedbackText.length > 20
  );

  //  Sort newest first
  result.sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  //  Fix meta so it's aligned with filtered result
  const meta = {
    total: result.length,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : result.length,
  };

  return {
    meta,
    data: result,
  };
};

const getSingleServiceFeedback = async (
  id: string
): Promise<ServiceFeedback | null> => {
  const result = await prisma.serviceFeedback.findUnique({
    where: { id },
    include: {
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
  return result;
};

const updateServiceFeedback = async (
  id: string,
  data: { rating?: number; feedbackText?: string },
  userId: string
): Promise<ServiceFeedback> => {
  const checkServiceFeedback = await prisma.serviceFeedback.findUnique({
    where: { id },
  });

  if (!checkServiceFeedback) {
    throw new AppError(status.NOT_FOUND, "Service feedback not found!");
  }

  const result = await prisma.serviceFeedback.update({
    where: { id },
    data: {
      rating: data.rating,
      feedbackText: data.feedbackText,
    },
  });
  return result;
};

const deleteServiceFeedback = async (
  id: string,
  user: User
): Promise<ServiceFeedback> => {
  let checkServiceFeedback = null;

  if (user?.role === UserRole.super_admin) {
    checkServiceFeedback = await prisma.serviceFeedback.findUnique({
      where: { id },
    });
  } else if (user?.role === UserRole.organization_admin) {
    checkServiceFeedback = await prisma.serviceFeedback.findFirst({
      where: {
        id,
        clientId: user.id,
      },
    });
  }

  if (!checkServiceFeedback) {
    throw new AppError(
      status.NOT_FOUND,
      "Service feedback not found or you are not authorized!"
    );
  }

  const result = await prisma.serviceFeedback.delete({
    where: { id },
  });
  return result;
};

const getServiceFeedbacksByClient = async (
  query: Record<string, unknown>,
  userId: string
) => {
  const serviceFeedbackQuery = new QueryBuilder(prisma.serviceFeedback, query)
    .search(["feedbackText"])
    .rawFilter({ clientId: userId })
    .sort()
    .paginate()
    .fields();

  const result = await serviceFeedbackQuery.execute();
  const meta = await serviceFeedbackQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getServiceFeedbacksByRating = async (
  rating: number,
  query: Record<string, unknown>
) => {
  const serviceFeedbackQuery = new QueryBuilder(prisma.serviceFeedback, query)
    .rawFilter({ rating })
    .sort()
    .paginate()
    .fields();

  const result = await serviceFeedbackQuery.execute();
  const meta = await serviceFeedbackQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

export const ServiceFeedbackServices = {
  createServiceFeedback,
  getAllServiceFeedbacks,
  getSingleServiceFeedback,
  updateServiceFeedback,
  deleteServiceFeedback,
  getServiceFeedbacksByClient,
  getMostValuableServiceFeedbacks,
  getServiceFeedbacksByRating,
};
