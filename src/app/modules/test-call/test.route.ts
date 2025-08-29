// src/routes/call.routes.ts
import { Router } from "express";
import { TestCallController } from "./test.controller";

const router = Router();

// Twilio webhook endpoints
router.post("/incoming", TestCallController.handleIncomingCall);
router.post("/status", TestCallController.handleCallStatus);

// Demo data management endpoints (for testing)
router.get("/demo-data", TestCallController.getDemoData);
router.patch("/demo-agent", TestCallController.updateDemoAgent);

export const TestCallRoutes = router;