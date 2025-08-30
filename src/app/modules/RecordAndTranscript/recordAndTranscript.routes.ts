// routes/twilio.routes.ts
import express from "express";
import { RecordAndTranscriptController } from "./recordAndTranscript.controller";
import { downloadRecording, playRecording } from "./recordAndTranscript.service";

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

// Play recording in dashboard (streaming)
router.get("/recordings/:recordingSid/play", playRecording);
router.get("/recordings/:recordingSid/download", downloadRecording);
export const RecordAndTranscriptRoutes = router;
