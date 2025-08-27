import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AgentServices } from "./agent.services";
import { User } from "@prisma/client";

const getAllAgent = catchAsync(async (req, res) => {
  const result = await AgentServices.getAllAgentFromDB(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agents are retrieved successfully!",
    data: result.data,
    meta: result.meta,
  });
});

const getAgentsByOrganization = catchAsync(async (req, res) => {
  const { organizationId } = req.params;
  const result = await AgentServices.getAgentsByOrganizationFromDB(organizationId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Organization agents retrieved successfully!",
    data: result.data,
    meta: result.meta,
  });
});

const getAvailableAgents = catchAsync(async (req, res) => {
  const result = await AgentServices.getAvailableAgentsFromDB(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Available agents retrieved successfully!",
    data: result.data,
    meta: result.meta,
  });
});

const getAgentById = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const result = await AgentServices.getAgentByIdFromDB(agentId);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent retrieved successfully!",
    data: result,
  });
});

const assignAgentToOrganization = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const user = req.user;
  const result = await AgentServices.assignAgentToOrganization(agentId, user as User);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent assigned to organization successfully!",
    data: result,
  });
});

const unassignAgentFromOrganization = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const result = await AgentServices.unassignAgentFromOrganization(agentId, req.user as User);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agent unassigned from organization successfully!",
    data: result,
  });
});


export const AgentController = {
  getAllAgent,
  getAgentsByOrganization,
  getAvailableAgents,
  getAgentById,
  assignAgentToOrganization,
  unassignAgentFromOrganization,
};