import { Router } from "express";
import { ToolsController } from "./tools.controller";

const router = Router();

router.post("/create-lead", ToolsController.createHubSpotLead);

router.get("/export/:organizationId", ToolsController.exportOrganizationData);

router.get("/organization/:orgId", ToolsController.getQuestionsByOrganization);

router.get(
  "/organization/:orgId/export",
  ToolsController.getQuestionsByOrganization
);

router.post(
  "/add-qa-pairs-to-sheets/:orgId",
  ToolsController.addQaPairsToGoogleSheets
);

export const ToolsRoutes = router;