

// // controllers/assignment.controller.ts
// import { Request, Response } from "express";
// import catchAsync from "../../utils/catchAsync";
// import status from "http-status";
// import sendResponse from "../../utils/sendResponse";
// import { AssignmentService } from "./agent.services";
// import { User } from "@prisma/client";
// import pickOptions from "../../utils/pick";

// // Organization admin requests assignment
// const requestAssignment = catchAsync(async (req: Request, res: Response) => {
//   const { agentId } = req.params;
//   const result = await AssignmentService.requestAgentAssignment(
//     agentId,
//     req.user as User
//   );


//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Assignment request submitted. Waiting for admin approval.",
//     data: result,
//   });
// });
// // Admin approves assignment
// const approveAssignment = catchAsync(async (req: Request, res: Response) => {
//   const {userId, organizationId} = req.body;
//   const result = await AssignmentService.approveAssignment(userId, organizationId);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Assignment approved successfully!",
//     data: result,
//   });
// });

// // Admin rejects assignment
// const rejectAssignment = catchAsync(async (req: Request, res: Response) => {
// const {userId, organizationId, reason = "Assignment rejected by admin."} = req.body;
//   const result = await AssignmentService.rejectAssignment(userId, organizationId, reason);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Assignment rejected successfully!",
//     data: result,
//   });
// });


// const getAllAgent = catchAsync(async (req, res) => {
//   const options = pickOptions(req.query, [
//     "limit",
//     "page",
//     "sortBy",
//     "sortOrder",
//   ]);
//   const filters = pickOptions(req.query, [
//     "searchTerm",
//     "isAvailable",
//     "status",
//     "viewType",
//   ]);
//   const result = await AssignmentService.getAllAgentFromDB(
//     options,
//     filters,
//     req.user as User
//   );

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agents are retrieved successfully!",
//     data: result,
//   });
// });

// const getAgentsManagementInfo = catchAsync(async (req, res) => {
//   const options = pickOptions(req.query, [
//     "limit",
//     "page",
//     "sortBy",
//     "sortOrder",
//   ]);
//   const filters = pickOptions(req.query, [
//     "searchTerm"
//   ]);
//   const result = await AssignmentService.getAgentsManagementInfo(
//     options,
//     filters
//   );

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agents are retrieved successfully!",
//     data: result,
//   });
// });



// const getAgentsId = catchAsync(async (req, res) => {
//   const user = req.user as User;
//   const result = await AssignmentService.getAllAgentIds(user);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agents Id are retrieved successfully!",
//     data: result,
//   });
// });

// const getAIAgents = catchAsync(async (req: Request, res: Response) => {
//   const result = await AssignmentService.getAIAgentIdsByOrganizationAdmin(
//     req.user as User
//   );

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "AI Agents retrieved successfully!",
//     data: result,
//   });
// });

// // removal request
// const requestAgentRemoval = catchAsync(async (req: Request, res: Response) => {
//   const { userId } = req.params;
//   const result = await AssignmentService.requestAgentRemoval(
//     userId,
//     req.user as User
//   );

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent removal requested successfully!",
//     data: result,
//   });
// });

// const approveAgentRemoval = catchAsync(async (req: Request, res: Response) => {
//   const {userId, organizationId} = req.body;
//   const result = await AssignmentService.approveAgentRemoval(userId, organizationId);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent removal approved by admin successfully!",
//     data: result,
//   });
// });


// const rejectAgentRemoval = catchAsync(async (req: Request, res: Response) => {
//     const {userId, organizationId, reason = "Agent removal rejected by admin."} = req.body;
//   const result = await AssignmentService.rejectAgentRemoval(
//     userId,
//     organizationId,
//     reason
//   );

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Agent removal rejected successfully!",
//     data: result,
//   });
// });



// const getApprovalRemovalRequestsForSuperAdmin = catchAsync(
//   async (req: Request, res: Response) => {
//     const options = pickOptions(req.query, [
//       "limit",
//       "page",
//       "sortBy",
//       "sortOrder",
//     ]);
//     const filters = pickOptions(req.query, [
//       "searchTerm",
//       "agentName",
//       "organizationName",
//       "status",
//     ]);
//     const result =
//       await AssignmentService.getApprovalRemovalRequestsForSuperAdmin(
//         options,
//         filters
//       );

//     sendResponse(res, {
//       statusCode: status.OK,
//       message: "Approval removal requests fetched successfully!",
//       data: result,
//     });
//   }
// );
// // Admin views pending assignments
// const getPendingAssignments = catchAsync(
//   async (req: Request, res: Response) => {
//     const result = await AssignmentService.getPendingAssignments();

//     sendResponse(res, {
//       statusCode: status.OK,
//       message: "Pending assignments fetched successfully!",
//       data: result,
//     });
//   }
// );

// // Get assignment status for an agent
// const getAgentAssignmentStatus = catchAsync(
//   async (req: Request, res: Response) => {
//     const { agentId } = req.params;
//     const result = await AssignmentService.getAgentAssignmentStatus(agentId);

//     sendResponse(res, {
//       statusCode: status.OK,
//       message: "Assignment status fetched successfully!",
//       data: result,
//     });
//   }
// );
// const getAgentCallsManagementInfo = catchAsync(async (req, res) => {
//   const options = pickOptions(req.query, [
//       "limit",
//       "page",
//       "sortBy",
//       "sortOrder",
//     ]);
//     const filters = pickOptions(req.query, [
//       "searchTerm",
//     ]);
//     const result =
//       await AssignmentService.getAgentCallsManagementInfo(
//         options,
//         filters,
//         req.user as User
//       );

//     sendResponse(res, {
//       statusCode: status.OK,
//       message: "Agents calls are retrieved successfully!",
//       data: result,
//     });
// })

// // Get assignments for an organization
// const getOrganizationAssignments = catchAsync(
//   async (req: Request, res: Response) => {
//     const { organizationId } = req.params;
//     const result = await AssignmentService.getOrganizationAssignments(
//       organizationId
//     );

//     sendResponse(res, {
//       statusCode: status.OK,
//       message: "Organization assignments fetched successfully!",
//       data: result,
//     });
//   }
// );

// export const AssignmentController = {
//   requestAssignment,
//   getAIAgents,
//   getAgentCallsManagementInfo,
//   getAgentsManagementInfo,
//   requestAgentRemoval,
//   approveAgentRemoval,
//   rejectAgentRemoval,
//   getAllAgent,
//   getApprovalRemovalRequestsForSuperAdmin,
//   getAgentsId,
//   getAllAgentForAdmin,
//   approveAssignment,
//   rejectAssignment,
//   getPendingAssignments,
//   getAgentAssignmentStatus,
//   getOrganizationAssignments,
// };




import status from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AgentAssignmentService } from "./agent.services";
import pickOptions from "../../utils/pick";
import { User } from "@prisma/client";

// ============ 1. GET ALL AGENTS WITH FILTERS ============

const getAllAgents = catchAsync(async (req: Request, res: Response) => {
  const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  // const filters = pickOptions(req.query, [
  //   "searchTerm",
  //   "isAvailable",
  //   "status",
  //   "viewType",
  // ]);
  const result = await AgentAssignmentService.getAllAgents(req.query, options);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agents retrieved successfully!",
    data: result,
  });
});

// ============ 2. GET ALL ASSIGNED AGENTS BY ORGANIZATION ID ============

const getAgentsByOrganization = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AgentAssignmentService.getAgentsByOrganization(
      req.params.organizationId,
      req.query
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Organization agents retrieved successfully!",
      data: result,
    });
  }
);

// ============ 3. ASSIGN AGENT TO ORGANIZATION ============

const assignAgentToOrganization = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const result = await AgentAssignmentService.assignAgentToOrganization(
      req.body,
      userId
    );

    sendResponse(res, {
      statusCode: status.CREATED,
      message: "Agent assigned to organization successfully!",
      data: result,
    });
  }
);

// ============ 4. REMOVE AGENT FROM ORGANIZATION ============

const removeAgentFromOrganization = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AgentAssignmentService.removeAgentFromOrganization(
      req.body
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Agent removed from organization successfully!",
      data: result,
    });
  }
);



const getAIAgents = catchAsync(async (req: Request, res: Response) => {
  const result = await AgentAssignmentService.getAIAgentIdsByOrganizationAdmin(
    req.user as User
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "AI Agents retrieved successfully!",
    data: result,
  });
});


const getUserAssignedQuestions = catchAsync(async (req: Request, res: Response) => {
   const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  const result = await AgentAssignmentService.getQuestionsByUserAssignments(
    req.user.id as string,
    options,
    req.query
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Questions retrieved successfully for your assigned organizations!",
    data: result,
  });
});

const getQuestionsByOrgNumber = catchAsync(async (req: Request, res: Response) => {
  const { organizationNumber } = req.params;
  const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  const result = await AgentAssignmentService.getQuestionsByOrgNumber(
    organizationNumber,
    options,
    req.query
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Questions retrieved successfully for organization!",
    data: result,
  });
});

const getAllOrgQuestions = catchAsync(async (req: Request, res: Response) => {
 const userId = req.user.id as string;
 const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  const result = await AgentAssignmentService.getAllOrgQuestions(
    userId,
    options
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "All organization questions retrieved successfully!",
    data: result,
  });
});

const getAgentsId = catchAsync(async (req, res) => {
  const user = req.user as User;
  const result = await AgentAssignmentService.getAllAgentIds(user);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agents Id are retrieved successfully!",
    data: result,
  });
});


const getAgentCallsManagementInfo = catchAsync(async (req, res) => {
  const options = pickOptions(req.query, [
      "limit",
      "page",
      "sortBy",
      "sortOrder",
    ]);
    const filters = pickOptions(req.query, [
      "searchTerm",
    ]);
    const result =
      await AgentAssignmentService.getAgentCallsManagementInfo(
        options,
        filters,
        req.user as User
      );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Agents calls are retrieved successfully!",
      data: result,
    });
})

const getAgentsManagementInfo = catchAsync(async (req, res) => {
  const options = pickOptions(req.query, [
    "limit",
    "page",
    "sortBy",
    "sortOrder",
  ]);
  const filters = pickOptions(req.query, [
    "searchTerm"
  ]);
  const result = await AgentAssignmentService.getAgentsManagementInfo(
    options,
    filters
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Agents are retrieved successfully!",
    data: result,
  });
});


export const AgentAssignmentController = {
  getAgentsManagementInfo,
  getAgentCallsManagementInfo,
  getUserAssignedQuestions,
  getQuestionsByOrgNumber,
  getAllOrgQuestions,
  getAllAgents,
  getAgentsId,
  getAIAgents,
  getAgentsByOrganization,
  assignAgentToOrganization,
  removeAgentFromOrganization,
};