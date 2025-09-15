import { Router } from "express";
import { ToolsController } from "./tools.controller";
import validateRequest from "../../middlewares/validateRequest";
import { ToolsValidation } from "./tools.validation";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

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

router.post(
  "/configure-google-sheets/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  validateRequest(ToolsValidation.configureGoogleSheetsSchema),
  ToolsController.configureGoogleSheets
);

export const ToolsRoutes = router;
