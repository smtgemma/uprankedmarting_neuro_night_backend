import { Router } from "express";
import { OrganizationController } from "./organization.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = Router();

router.get(
  "/",
  //   auth(UserRole.super_admin),
  OrganizationController.getAllOrganizations
);

router.get(
  '/organization-call-logs',
  auth(UserRole.organization_admin), 
  OrganizationController.getOrganizationCallLogsManagement
);

router.get(
  '/platform-overview-stats',
  OrganizationController.getPlatformOverview
);

router.get(
  "/:organizationId",
  //   auth(UserRole.organization_admin, UserRole.super_admin),
  OrganizationController.getSingleOrganization
);

router.post("/usage/update", OrganizationController.updateUsage);


// router.post(
//   "/",
//   auth(UserRole.super_admin),
//   validateRequest(OrganizationValidation.CreateOrganizationValidationSchema),
//   OrganizationController.createOrganization
// );

// router.put(
//   "/:organizationId",
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   validateRequest(OrganizationValidation.UpdateOrganizationValidationSchema),
//   OrganizationController.updateOrganization
// );

// router.delete(
//   "/:organizationId",
//   auth(UserRole.super_admin),
//   OrganizationController.deleteOrganization
// );

export const OrganizationRoutes = router;
