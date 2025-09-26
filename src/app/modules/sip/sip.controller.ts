// controllers/twilioSip.controller.ts
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import status from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { TwilioSipService } from './sip.service';

// Create SIP endpoint
const createSipEndpoint = catchAsync(async (req: Request, res: Response) => {

  
  const result = await TwilioSipService.createSipEndpoint(req.body);
  
  sendResponse(res, {
    statusCode: status.CREATED,
    message: "SIP endpoint created successfully!",
    data: result,
  });
});

// Get all SIP endpoints
const getSipEndpoints = catchAsync(async (req: Request, res: Response) => {
  // const { domainSid } = req.query;
  
  // const result = await TwilioSipService.getSipEndpoints(domainSid as string);
  
  // sendResponse(res, {
  //   statusCode: status.OK,
  //   message: 'SIP endpoints fetched successfully!',
  //   data: result,
  // });
});

// Get default domain
const getDefaultSipDomain = catchAsync(async (req: Request, res: Response) => {
  // const result = await TwilioSipService.getDefaultDomain();
  
  // sendResponse(res, {
  //   statusCode: status.OK,
  //   message: 'Default SIP domain fetched successfully!',
  //   data: { domainSid: result },
  // });
});

export const TwilioSipController = {
  createSipEndpoint,
  getSipEndpoints,
  getDefaultSipDomain
};