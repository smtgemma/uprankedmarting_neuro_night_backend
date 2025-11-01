// modules/plan/plan.route.ts
import { Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createPlanValidation, updatePlanValidation } from "./plan.validation";
import { PlanController } from "./plan.controller";

const router = Router();

// Admin only
router.post(
  "/",
  auth("super_admin"),
  validateRequest(createPlanValidation),
  PlanController.createPlan
);

router.patch(
  "/:id",
  auth("super_admin"),
  validateRequest(updatePlanValidation),
  PlanController.updatePlan
);

router.delete("/:id", auth("super_admin"), PlanController.deletePlan);

// Public
router.get("/", PlanController.getAllPlans);
router.get("/:id", PlanController.getPlanById);

export const PlanRoutes = router;