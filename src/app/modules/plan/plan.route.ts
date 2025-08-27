import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { PlanController } from "./plan.controller";
import { planValidationSchema } from "./plan.validation";
import validateRequest from "../../middlewares/validateRequest";

const router = Router();

router.post(
  "/create-plan",
  auth(UserRole.super_admin),
  validateRequest(planValidationSchema),
  PlanController.createPlan
);

router.get("/", PlanController.getAllPlans);

router.get("/:planId", PlanController.getPlanById);

router.delete(
  "/:planId",
  auth(UserRole.super_admin),
  PlanController.deletePlan
);

export const PlanRoutes = router;
