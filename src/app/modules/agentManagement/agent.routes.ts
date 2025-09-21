// import { Router } from "express";
// import { AgentController } from "./agent.controller";
// import auth from "../../middlewares/auth";
// import { UserRole } from "@prisma/client";

// const router = Router();

// router.get("/", AgentController.getAllAgent);
// router.get("/available", AgentController.getAvailableAgents);
// router.get(
//   "/organization/:organizationId",
//   AgentController.getAgentsByOrganization
// );
// router.get("/:agentId", AgentController.getAgentById);
// router.patch(
//   "/:agentId/assign",
//   auth(UserRole.organization_admin),
//   AgentController.assignAgentToOrganization
// );
// router.patch(
//   "/:agentId/unassign",
//   auth(UserRole.organization_admin),
//   AgentController.unassignAgentFromOrganization
// );

// export const AgentRoutes = router;

// routes/assignment.routes.ts
import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { AssignmentController } from "./agent.controller";

const router = express.Router();

router.get(
  "/",
  auth(UserRole.organization_admin, UserRole.super_admin),
  AssignmentController.getAllAgent
);
router.get(
  '/ai-agents',
  auth(UserRole.organization_admin, UserRole.super_admin),
  AssignmentController.getAIAgents
);

router.get(
  "/get-agent-ids",
  auth(UserRole.organization_admin, UserRole.super_admin),
  AssignmentController.getAgentsId
);
router.get(
  "/all-agent-assignment-request",
  auth(UserRole.super_admin),
  AssignmentController.getAllAgentForAdmin
);
router.get(
  "/get-all-assignments-request",
  auth(UserRole.super_admin),
  AssignmentController.getApprovalRemovalRequestsForSuperAdmin
);

// Admin only routes
router.get(
  "/pending",
  auth(UserRole.super_admin),
  AssignmentController.getPendingAssignments
);

// ---------------------------

router.post(
  "/request/:agentId",
  auth(UserRole.organization_admin),
  AssignmentController.requestAssignment
);

router.patch(
  "/approve-agent-assignment",
  auth(UserRole.super_admin),
  AssignmentController.approveAssignment
);

router.patch(
  "/reject-agent-assignment",
  auth(UserRole.super_admin),
  AssignmentController.rejectAssignment
);

// ---------------------------

// -----------------------
router.patch(
  "/:userId/request-agent-removal",
  auth(UserRole.organization_admin),
  AssignmentController.requestAgentRemoval
);

router.patch(
  "/approve-agent-removal",
  auth(UserRole.super_admin),
  AssignmentController.approveAgentRemoval
);

router.patch(
  "/reject-agent-removal",
  auth(UserRole.super_admin),
  AssignmentController.rejectAgentRemoval
);

// ----------------------

// Get assignment status for an agent
router.get(
  "/agent/:agentId/status",
  auth(),
  AssignmentController.getAgentAssignmentStatus
);

// Get assignments for an organization
router.get(
  "/organization/:organizationId",
  auth(UserRole.organization_admin, UserRole.super_admin),
  AssignmentController.getOrganizationAssignments
);

// Get Agents Management Info by super admin
router.get(
  "/agents-management-info",
  auth(UserRole.super_admin),
  AssignmentController.getAgentsManagementInfo
);


// Agent dashboard
router.get(
  "/agent-calls-management-info",
  auth(UserRole.agent),
  AssignmentController.getAgentCallsManagementInfo
);



export const AssignmentRoutes = router;
