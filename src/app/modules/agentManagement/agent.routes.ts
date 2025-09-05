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

// Organization admin requests assignment
router.post(
  "/request/:agentId",
  auth(UserRole.organization_admin),
  AssignmentController.requestAssignment
);

router.get("/", auth(UserRole.organization_admin, UserRole.super_admin), AssignmentController.getAllAgent);
router.get("/get-agent-ids", auth(UserRole.organization_admin, UserRole.super_admin), AssignmentController.getAgentsId);
router.get("/all-agent", auth(UserRole.super_admin), AssignmentController.getAllAgentForAdmin);
router.get("/get-all-assignments-request", auth(UserRole.super_admin), AssignmentController.getApprovalRemovalRequestsForSuperAdmin);

// Admin only routes
router.get(
  "/pending",
  auth(UserRole.super_admin),
  AssignmentController.getPendingAssignments
);
router.patch(
  "/approve/:assignmentId",
  auth(UserRole.super_admin),
  AssignmentController.approveAssignment
);

router.patch(
  "/:agentId/request-agent-removal",
  auth(UserRole.organization_admin),
  AssignmentController.requestAgentRemoval
);

router.patch(
  "/:assignmentId/approve-agent-removal",
  auth(UserRole.super_admin),
  AssignmentController.approveAgentRemoval
);

router.patch(
    "/:assignmentId/reject-agent-removal",
  auth(UserRole.super_admin),
  AssignmentController.rejectAgentRemoval
)
router.patch(
  "/reject/:assignmentId",
  auth(UserRole.super_admin),
  AssignmentController.rejectAssignment
);

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

export const AssignmentRoutes = router;
