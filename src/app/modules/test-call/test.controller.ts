// src/controllers/call.controller.ts
import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Request, Response } from "express";
// import { TestCallService } from "./test.service";

const handleIncomingCall = catchAsync(async (req: Request, res: Response) => {
  // console.log("what i am getting from incomming call", req.body)
  // const { From, To, CallSid } = req.body;
  
  // const twimlResponse = await TestCallService.handleIncomingCall(From, To, CallSid);
  
  // res.type('text/xml');
  // res.send(twimlResponse);
});

const handleCallStatus = catchAsync(async (req: Request, res: Response) => {
  // const { CallStatus, CallSid, To } = req.body;
  
  // await TestCallService.updateCallStatus(CallStatus, CallSid, To);
  
  // res.status(status.OK).send();
});

// Additional endpoints for managing demo data (for testing)
const getDemoData = catchAsync(async (req: Request, res: Response) => {
  // This would return the current demo data state
  const demoData = {
    subscribers: {
      "+18633445510": { plan: "real_agent" },
    },
    agents: [
      { name: "Alice", available: true, sip_address: "sip:hudaisip@test-sip-sajjad.sip.twilio.com" },
      { name: "Bob", available: false, sip_address: "sip:bob@company.com" }
    ]
  };
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Demo data retrieved successfully",
    data: demoData
  });
});

const updateDemoAgent = catchAsync(async (req: Request, res: Response) => {
  const { agentName, available } = req.body;
  
  // Update demo agent availability (for testing)
  const agentIndex = demoAgents.findIndex(agent => agent.name === agentName);
  if (agentIndex !== -1) {
    demoAgents[agentIndex].available = available;
  }
  
  sendResponse(res, {
    statusCode: status.OK,
    message: "Demo agent updated successfully",
    data: demoAgents
  });
});

export const TestCallController = {
  handleIncomingCall,
  handleCallStatus,
  getDemoData,
  updateDemoAgent
};

// Demo data (would be in a separate file in real implementation)
const demoAgents = [
  { name: "Alice", available: true, sip_address: "sip:hudaisip@test-sip-sajjad.sip.twilio.com" },
  { name: "Bob", available: false, sip_address: "sip:bob@company.com" }
];