import { PrismaClient, AgentFeedback, User } from "@prisma/client";
import QueryBuilder from "../../../builder/QueryBuilder";
import prisma from "../../../utils/prisma";
import AppError from "../../../errors/AppError";
import status from "http-status";

const createAgentFeedback = async (
  data: { rating: number; feedbackText?: string },
  userId: string,
  agentId: string
): Promise<AgentFeedback> => {
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

const getAllAgentFeedbacks = async (query: Record<string, unknown>, user: User) => {

  const agent = await prisma.agent.findUnique({
    where: {
      userId: user?.id
    }
  })

  console.log(agent)

  // console.log("Agent:", agent)
  const agentFeedbackQuery = new QueryBuilder(prisma.agentFeedback, query)
    .search(["feedbackText"])
    .filter()
    .rawFilter({
      agentId: agent?.id,
    })
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

const getSingleAgentFeedback = async (
  id: string
): Promise<AgentFeedback | null> => {
  const result = await prisma.agentFeedback.findUnique({
    where: { id },
    include: {
      agent: true, // Include all agent fields to avoid strict typing issues
      client: true, // Include all client fields to avoid strict typing issues
    },
  });
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

const deleteAgentFeedback = async (
  id: string,
  clientId: string
): Promise<AgentFeedback> => {
  const checkAgentFeedback = await prisma.agentFeedback.findUnique({
    where: { id },
  });

  if (!checkAgentFeedback) {
    throw new AppError(status.NOT_FOUND, "Agent feedback not found!");
  }

  const result = await prisma.agentFeedback.delete({
    where: { id },
  });
  return result;
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
