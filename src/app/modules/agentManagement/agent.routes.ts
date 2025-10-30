
// // routes/assignment.routes.ts
// import express from "express";
// import auth from "../../middlewares/auth";
// import { UserRole } from "@prisma/client";
// import { AssignmentController } from "./agent.controller";

// const router = express.Router();

// router.get(
//   "/",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   AssignmentController.getAllAgent
// );
// router.get(
//   '/ai-agents',
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   AssignmentController.getAIAgents
// );

// router.get(
//   "/get-agent-ids",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   AssignmentController.getAgentsId
// );
// router.get(
//   "/all-agent-assignment-request",
//   auth(UserRole.super_admin),
//   AssignmentController.getAllAgentForAdmin
// );
// router.get(
//   "/get-all-assignments-request",
//   auth(UserRole.super_admin),
//   AssignmentController.getApprovalRemovalRequestsForSuperAdmin
// );

// // Admin only routes
// router.get(
//   "/pending",
//   auth(UserRole.super_admin),
//   AssignmentController.getPendingAssignments
// );

// // ---------------------------

// router.post(
//   "/request/:agentId",
//   auth(UserRole.organization_admin),
//   AssignmentController.requestAssignment
// );

// router.patch(
//   "/approve-agent-assignment",
//   auth(UserRole.super_admin),
//   AssignmentController.approveAssignment
// );

// router.patch(
//   "/reject-agent-assignment",
//   auth(UserRole.super_admin),
//   AssignmentController.rejectAssignment
// );

// // ---------------------------

// // -----------------------
// router.patch(
//   "/:userId/request-agent-removal",
//   auth(UserRole.organization_admin),
//   AssignmentController.requestAgentRemoval
// );

// router.patch(
//   "/approve-agent-removal",
//   auth(UserRole.super_admin),
//   AssignmentController.approveAgentRemoval
// );

// router.patch(
//   "/reject-agent-removal",
//   auth(UserRole.super_admin),
//   AssignmentController.rejectAgentRemoval
// );

// // ----------------------

// // Get assignment status for an agent
// router.get(
//   "/agent/:agentId/status",
//   auth(),
//   AssignmentController.getAgentAssignmentStatus
// );

// // Get assignments for an organization
// router.get(
//   "/organization/:organizationId",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   AssignmentController.getOrganizationAssignments
// );

// // Get Agents Management Info by super admin
// router.get(
//   "/agents-management-info",
//   auth(UserRole.super_admin),
//   AssignmentController.getAgentsManagementInfo
// );


// // Agent dashboard
// router.get(
//   "/agent-calls-management-info",
//   auth(UserRole.agent),
//   AssignmentController.getAgentCallsManagementInfo
// );



// export const AssignmentRoutes = router;


import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { AgentAssignmentController } from "./agent.controller";

const router = express.Router();

// ============ MAIN ROUTES ============

// 1. Get all agents with filters (assigned/unassigned)
router.get(
  "/",
  auth(UserRole.super_admin),
  AgentAssignmentController.getAllAgents
);

// 2. Get all assigned agents by organization ID
router.get(
  "/organization/:organizationId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  AgentAssignmentController.getAgentsByOrganization
);

// 3. Assign agent to organization
router.post(
  "/assign",
  auth(UserRole.super_admin),
  AgentAssignmentController.assignAgentToOrganization
);

// 4. Remove agent from organization
router.delete(
  "/remove",
  auth(UserRole.super_admin),
  AgentAssignmentController.removeAgentFromOrganization
);

router.get(
  '/ai-agents',
  auth(UserRole.organization_admin, UserRole.super_admin),
  AgentAssignmentController.getAIAgents
);



// ============ MAIN ROUTES ============
// 1. Get questions for user's assigned organizations (Agent Dashboard)
router.get(
  "/my-questions",
  auth(UserRole.agent),
  AgentAssignmentController.getUserAssignedQuestions
);

// 2. Get questions by organization number
router.get(
  "/organization/:organizationNumber/questions",
  auth(UserRole.organization_admin, UserRole.super_admin),
  AgentAssignmentController.getQuestionsByOrgNumber
);

// 3. Get all questions for organization (Admin view)
router.get(
  "/organization/:organizationId/all",
  auth(UserRole.organization_admin, UserRole.super_admin),
  AgentAssignmentController.getAllOrgQuestions
);
export const AssignmentRoutes = router;