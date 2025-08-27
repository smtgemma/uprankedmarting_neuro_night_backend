import status from "http-status";
import QueryBuilder from "../../builder/QueryBuilder";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import { User, UserRole } from "@prisma/client";

const getAllAgentFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email"])
    .filter()
    .rawFilter({
      isDeleted: false,
      role: "agent",
    })
    // Add agent availability filtering
    .rawFilter(query.isAvailable ? {
      Agent: {
        isAvailable: query.isAvailable === 'true' || query.isAvailable === true
      }
    } : {})
    .sort()
    .include({
      Agent: true,
    })
    .paginate();

  const [result, meta] = await Promise.all([
    userQuery.execute(),
    userQuery.countTotal(),
  ]);

  if (!result.length) {
    throw new AppError(status.NOT_FOUND, "No agents found!");
  }

  const data = result.map((user: User) => {
    const { password, ...rest } = user;
    return rest;
  });

  return {
    meta,
    data,
  };
};

const getAgentsByOrganizationFromDB = async (
  organizationId: string,
  query: Record<string, unknown>
) => {
  // Validate if organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  const agentQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email"])
    .filter()
    .rawFilter({
      isDeleted: false,
      role: "agent",
      Agent: {
        assignTo: organizationId,
      },
    })
    .sort()
    .include({
      Agent: true,
    })
    .paginate();

  const [result, meta] = await Promise.all([
    agentQuery.execute(),
    agentQuery.countTotal(),
  ]);

  if (!result.length) {
    throw new AppError(
      status.NOT_FOUND,
      "No agents found for this organization!"
    );
  }

  const data = result.map((user: User) => {
    const { password, ...rest } = user;
    return rest;
  });

  return {
    meta,
    data,
  };
};

const getAvailableAgentsFromDB = async (query: Record<string, unknown>) => {
  const agentQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email"])
    .filter()
    .rawFilter({
      isDeleted: false,
      role: "agent",
      Agent: {
        isAvailable: true,
      },
    })
    .sort()
    .include({
      Agent: true,
    })
    .paginate();

  const [result, meta] = await Promise.all([
    agentQuery.execute(),
    agentQuery.countTotal(),
  ]);

  if (!result.length) {
    throw new AppError(status.NOT_FOUND, "No available agents found!");
  }

  const data = result.map((user: User) => {
    const { password, ...rest } = user;
    return rest;
  });

  return {
    meta,
    data,
  };
};

const getAgentByIdFromDB = async (agentId: string) => {
  const agent = await prisma.user.findUnique({
    where: {
      id: agentId,
      isDeleted: false,
      role: "agent",
    },
    include: {
      Agent: {
        include: {
          organization: true,
          AgentFeedbacks: true,
          calls: true,
        },
      },
    },
  });

  if (!agent) {
    throw new AppError(status.NOT_FOUND, "Agent not found!");
  }

  const { password, ...agentData } = agent;
  return agentData;
};

const assignAgentToOrganization = async (agentId: string, user: User) => {
  // Validate agent exists and is an agent
  const agent = await prisma.user.findUnique({
    where: {
      id: agentId,
      isDeleted: false,
      role: "agent",
    },
    include: { Agent: true },
  });

  if (!agent) {
    throw new AppError(status.NOT_FOUND, "Agent not found!");
  }

  // Validate organization exists
  const organization = await prisma.organization.findUnique({
    where: { ownerId: user?.id },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  if (user.role !== UserRole.super_admin) {
    if (organization.ownerId !== user.id) {
      throw new AppError(
        status.UNAUTHORIZED,
        "You are not authorized to assign agents to this organization!"
      );
    }
  }

  // Update agent assignment
  const updatedAgent = await prisma.agent.update({
    where: { userId: agentId },
    data: {
      assignTo: organization.id,
      isAvailable: false,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      organization: true,
    },
  });

  return updatedAgent;
};

const unassignAgentFromOrganization = async (agentId: string, user: User) => {
  // Validate agent exists and is an agent
  const agent = await prisma.user.findUnique({
    where: {
      id: agentId,
      isDeleted: false,
      role: "agent",
    },
    include: { Agent: true },
  });

  if (!agent) {
    throw new AppError(status.NOT_FOUND, "Agent not found!");
  }

  // Validate organization exists
  const organization = await prisma.organization.findUnique({
    where: { ownerId: user?.id },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  if (user.role !== UserRole.super_admin) {
    if (organization.ownerId !== user.id) {
      throw new AppError(
        status.UNAUTHORIZED,
        "You are not authorized to assign agents to this organization!"
      );
    }
  }
  // Remove assignment
  const updatedAgent = await prisma.agent.update({
    where: { userId: agentId },
    data: {
      assignTo: null,
      isAvailable: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return updatedAgent;
};

export const AgentServices = {
  getAllAgentFromDB,
  getAgentsByOrganizationFromDB,
  getAvailableAgentsFromDB,
  getAgentByIdFromDB,
  assignAgentToOrganization,
  unassignAgentFromOrganization,
};
