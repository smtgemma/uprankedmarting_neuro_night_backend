import { Router } from "express";
import { AgentController } from "./agent.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = Router();

router.get("/", AgentController.getAllAgent);
router.get("/available", AgentController.getAvailableAgents);
router.get(
  "/organization/:organizationId",
  AgentController.getAgentsByOrganization
);
router.get("/:agentId", AgentController.getAgentById);
router.patch(
  "/:agentId/assign",
  auth(UserRole.organization_admin),
  AgentController.assignAgentToOrganization
);
router.patch(
  "/:agentId/unassign",
  auth(UserRole.organization_admin),
  AgentController.unassignAgentFromOrganization
);

export const AgentRoutes = router;
