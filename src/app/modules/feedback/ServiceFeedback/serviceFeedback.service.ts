import { PrismaClient, ServiceFeedback } from "@prisma/client";
import QueryBuilder from "../../../builder/QueryBuilder";
import prisma from "../../../utils/prisma";
import AppError from "../../../errors/AppError";
import status from "http-status";

const createServiceFeedback = async (
  data: { rating: number; feedbackText?: string },
  userId: string
): Promise<ServiceFeedback> => {
  
  const serviceData = {
    rating: data.rating,
    feedbackText: data.feedbackText || undefined, // Optional field
    clientId: userId,
  };

  const result = await prisma.serviceFeedback.create({
    data: serviceData,
  });
  return result;
};

const getAllServiceFeedbacks = async (query: Record<string, unknown>) => {


  const serviceFeedbackQuery = new QueryBuilder(prisma.serviceFeedback, query);


  const result = await serviceFeedbackQuery.execute();
  const meta = await serviceFeedbackQuery.countTotal();


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
      client: true, // Include all client fields to avoid strict typing issues
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
  clientId: string
): Promise<ServiceFeedback> => {
  const checkServiceFeedback = await prisma.serviceFeedback.findUnique({
    where: { id },
  });

  if (!checkServiceFeedback) {
    throw new AppError(status.NOT_FOUND, "Service feedback not found!");
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
  getServiceFeedbacksByRating,
};