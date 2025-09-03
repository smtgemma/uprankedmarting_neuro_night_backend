// import status from "http-status";
// import catchAsync from "../../utils/catchAsync";
// import sendResponse from "../../utils/sendResponse";
// import { AgentServices } from "./agent.services";
// import { User } from "@prisma/client";

// const getAllAgent = catchAsync(async (req, res) => {
//   const result = await AgentServices.getAllAgentFromDB(req.query);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agents are retrieved successfully!",
//     data: result.data,
//     meta: result.meta,
//   });
// });

// const getAgentsByOrganization = catchAsync(async (req, res) => {
//   const { organizationId } = req.params;
//   const result = await AgentServices.getAgentsByOrganizationFromDB(organizationId, req.query);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Organization agents retrieved successfully!",
//     data: result.data,
//     meta: result.meta,
//   });
// });

// const getAvailableAgents = catchAsync(async (req, res) => {
//   const result = await AgentServices.getAvailableAgentsFromDB(req.query);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Available agents retrieved successfully!",
//     data: result.data,
//     meta: result.meta,
//   });
// });

// const getAgentById = catchAsync(async (req, res) => {
//   const { agentId } = req.params;
//   const result = await AgentServices.getAgentByIdFromDB(agentId);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent retrieved successfully!",
//     data: result,
//   });
// });

// const assignAgentToOrganization = catchAsync(async (req, res) => {
//   const { agentId } = req.params;
//   const user = req.user;
//   const result = await AgentServices.assignAgentToOrganization(agentId, user as User);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent assigned to organization successfully!",
//     data: result,
//   });
// });

// const unassignAgentFromOrganization = catchAsync(async (req, res) => {
//   const { agentId } = req.params;
//   const result = await AgentServices.unassignAgentFromOrganization(agentId, req.user as User);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent unassigned from organization successfully!",
//     data: result,
//   });
// });


// export const AgentController = {
//   getAllAgent,
//   getAgentsByOrganization,
//   getAvailableAgents,
//   getAgentById,
//   assignAgentToOrganization,
//   unassignAgentFromOrganization,
// };


// controllers/assignment.controller.ts
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import status from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { AssignmentService } from './agent.services';
import { User } from '@prisma/client';
import pickOptions from '../../utils/pick';

// Organization admin requests assignment
const requestAssignment = catchAsync(async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const result = await AssignmentService.requestAgentAssignment(agentId, req.user as User);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: result,
  });
});

const getAllAgent = catchAsync(async (req, res) => {
  const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  const filters = pickOptions(req.query, [
    "searchTerm",
    "isAvailable",
    "status"
  ]);
  const result = await AssignmentService.getAllAgentFromDB(options, filters, req.user as User);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agents are retrieved successfully!",
    data: result
  });
});

// Admin approves assignment
const approveAssignment = catchAsync(async (req: Request, res: Response) => {
  const { assignmentId } = req.params;
  const result = await AssignmentService.approveAssignment(assignmentId);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: result,
  });
});

// Admin rejects assignment
const rejectAssignment = catchAsync(async (req: Request, res: Response) => {
  const { assignmentId } = req.params;
  // const { reason } = req.body;
  const result = await AssignmentService.rejectAssignment(assignmentId);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Assignment rejected successfully!",
    data: result,
  });
});

// Admin views pending assignments
const getPendingAssignments = catchAsync(async (req: Request, res: Response) => {
  const result = await AssignmentService.getPendingAssignments();
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Pending assignments fetched successfully!',
    data: result,
  });
});

// Get assignment status for an agent
const getAgentAssignmentStatus = catchAsync(async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const result = await AssignmentService.getAgentAssignmentStatus(agentId);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Assignment status fetched successfully!',
    data: result,
  });
});

// Get assignments for an organization
const getOrganizationAssignments = catchAsync(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const result = await AssignmentService.getOrganizationAssignments(organizationId);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Organization assignments fetched successfully!',
    data: result,
  });
});

export const AssignmentController = {
  requestAssignment,
  getAllAgent,
  approveAssignment,
  rejectAssignment,
  getPendingAssignments,
  getAgentAssignmentStatus,
  getOrganizationAssignments,
};