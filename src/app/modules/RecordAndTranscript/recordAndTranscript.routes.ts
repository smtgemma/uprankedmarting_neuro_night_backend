// routes/twilio.routes.ts
import express from "express";
import { RecordAndTranscriptController } from "./recordAndTranscript.controller";
import { downloadRecording, playRecording, playRecordingByCallSid } from "./recordAndTranscript.service";

const router = express.Router();

router.get(
  "/recordings/call/:callSid",
  RecordAndTranscriptController.getCallRecording
);
router.get(
  "/transcripts/call/:callSid",
  RecordAndTranscriptController.getCallTranscript
);
router.get(
  "/call/:callSid",
  RecordAndTranscriptController.getCallRecordingAndTranscript
);
router.get(
  "/recordings/:recordingSid",
  RecordAndTranscriptController.getRecordingBySid
);
router.get(
  "/transcripts/:transcriptSid",
  RecordAndTranscriptController.getTranscriptBySid
);
router.get(
  "/organization/:organizationId",
  RecordAndTranscriptController.getOrganizationCallRecords
);
// http://localhost:5000/api/v1/call-logs/recordings/play/CAe47d0d4b57d1191098ce07df87d497b3
// Play recording in dashboard (streaming)
// router.get("/recordings/:recordingSid/play", playRecording);
router.get("/recordings/play/:callSid", playRecordingByCallSid);
router.get("/recordings/:recordingSid/download", downloadRecording);
export const RecordAndTranscriptRoutes = router;
