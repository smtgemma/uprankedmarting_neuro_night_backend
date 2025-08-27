import { Router } from "express";
import { CallController } from "./calls.controller";

const router = Router();

// Add verifyTelnyxWebhook middleware to the incoming and hangup routes
router.post("/incoming",  CallController.handleIncomingCall);
router.post("/hangup", CallController.handleCallHangup);

export const CallRoutes = router;
