import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { ToolsValidation } from "./tools.validation";
import { ToolsController } from "./tools.controller";
import validateRequest from "../../middlewares/validateRequest";


const router = Router();

router.post(
  "/create-lead",
  auth(UserRole.organization_admin, UserRole.super_admin),
  validateRequest(ToolsValidation.CreateLeadSchema),
  ToolsController.createHubSpotLead
);

export const ToolsRoutes = router;