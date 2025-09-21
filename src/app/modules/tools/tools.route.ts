import { Router } from "express";

import { UserRole } from "@prisma/client";
import { ToolsController } from "./tools.controller";
import auth from "../../middlewares/auth";

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

// Google Sheets OAuth routes
router.get(
  "/google-sheets/connect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.getGoogleSheetsConnectUrl
);

router.get(
  "/google-sheets/callback",
  ToolsController.handleGoogleSheetsCallback
);

router.get(
  "/google-sheets/status/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.getGoogleSheetsStatus
);

router.delete(
  "/google-sheets/disconnect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.disconnectGoogleSheets
);

// HubSpot OAuth routes
router.get(
  "/hubspot/connect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.getHubSpotConnectUrl
);

router.get(
  "/hubspot/callback",
  ToolsController.handleHubSpotCallback
);

router.post(
  "/add-qa-pairs-to-hubspot/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.addQaPairsToHubSpot
);

router.get(
  "/hubspot/status/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.getHubSpotStatus
);

router.delete(
  "/hubspot/disconnect/:orgId",
  auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.disconnectHubSpot
);


router.post(
  "/reset-sync/:orgId",
  auth(UserRole.super_admin),
  ToolsController.resetSyncTimestamps
);

export const ToolsRoutes = router;