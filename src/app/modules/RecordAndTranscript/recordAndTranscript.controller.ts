// controllers/twilio.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import status from "http-status";
import sendResponse from "../../utils/sendResponse";
import { RecordAndTranscriptService } from "./recordAndTranscript.service";

// Get call recording by call SID
const getCallRecording = catchAsync(async (req: Request, res: Response) => {
  const { callSid } = req.params;
  const result = await RecordAndTranscriptService.getCallRecording(callSid);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Call recording fetched successfully!",
    data: result,
  });
});

// Get call transcript by call SID
const getCallTranscript = catchAsync(async (req: Request, res: Response) => {
  const { callSid } = req.params;
  const result = await RecordAndTranscriptService.getCallTranscript(callSid);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Call transcript fetched successfully!",
    data: result,
  });
});

// Get both recording and transcript for a call
const getCallRecordingAndTranscript = catchAsync(async (req: Request, res: Response) => {
  const { callSid } = req.params;
  const result = await RecordAndTranscriptService.getCallRecordingAndTranscript(callSid);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Call recording and transcript fetched successfully!",
    data: result,
  });
});

// Get recording by recording SID
const getRecordingBySid = catchAsync(async (req: Request, res: Response) => {
  const { recordingSid } = req.params;
  const result = await RecordAndTranscriptService.getRecordingBySid(recordingSid);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Recording fetched successfully!",
    data: result,
  });
});

// Get transcript by transcript SID
const getTranscriptBySid = catchAsync(async (req: Request, res: Response) => {
  const { transcriptSid } = req.params;
  const result = await RecordAndTranscriptService.getTranscriptBySid(transcriptSid);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Transcript fetched successfully!",
    data: result,
  });
});

// Get call records for an organization
const getOrganizationCallRecords = catchAsync(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const result = await RecordAndTranscriptService.getOrganizationCallRecords(organizationId);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Organization call records fetched successfully!",
    data: result,
  });
});

export const RecordAndTranscriptController = {
  getCallRecording,
  getCallTranscript,
  getCallRecordingAndTranscript,
  getRecordingBySid,
  getTranscriptBySid,
  getOrganizationCallRecords
};