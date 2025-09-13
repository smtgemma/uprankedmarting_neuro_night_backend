import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { ToolsValidation } from "./tools.validation";
import { ToolsController } from "./tools.controller";
import validateRequest from "../../middlewares/validateRequest";

const router = Router();

router.post(
  "/create-lead",
  // auth(UserRole.organization_admin, UserRole.super_admin),
  // validateRequest(ToolsValidation.CreateLeadSchema),
  ToolsController.createHubSpotLead
);

router.get(
  "/export/:organizationId",
  // auth(UserRole.super_admin, UserRole.organization_admin),
  ToolsController.exportOrganizationData
);

router.get(
  "/organization/:orgId",
  // validateRequest(ToolsValidation.questionValidationSchema),
  ToolsController.getQuestionsByOrganization
);

router.get(
  "/organization/:orgId/export",
  // validateRequest(ToolsValidation.questionValidationSchema),
  ToolsController.getQuestionsByOrganization
);

router.post(
  "/add-qa-pairs-to-sheets/:orgId",
  // auth(UserRole.organization_admin, UserRole.super_admin),
  // validateRequest(ToolsValidation.questionValidationSchema),
  ToolsController.addQaPairsToGoogleSheets
);

export const ToolsRoutes = router;
