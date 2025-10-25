import { Router } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import {
  planValidationSchema,
  updatePlanValidationSchema,
} from "./plan.validation";
import { PlanController } from "./plan.controller";

const router = Router();

router.post(
  "/create-plan",
  auth(UserRole.super_admin),
  validateRequest(planValidationSchema),
  PlanController.createPlan
);

router.get("/", PlanController.getAllPlans);

router.get("/:planId", PlanController.getPlanById);

router.patch(
  "/:planId",
  auth(UserRole.super_admin),
  validateRequest(updatePlanValidationSchema),
  PlanController.updatePlan
);

router.delete(
  "/:planId",
  auth(UserRole.super_admin),
  PlanController.deletePlan
);

export const PlanRoutes = router;
