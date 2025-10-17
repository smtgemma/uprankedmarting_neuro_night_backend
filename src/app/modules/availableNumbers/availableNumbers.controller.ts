import status from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TwilioPhoneNumberService } from "./availableNumbers.services";

const createTwilioPhoneNumber = catchAsync(
  async (req: Request, res: Response) => {
    //   const result = await TwilioPhoneNumberService.createTwilioPhoneNumberIntoDB(
    //     req.body
    //   );

    sendResponse(res, {
      statusCode: status.CREATED,
      message: "Twilio phone number purchased successfully!",
      data: null,
    });
  }
);

const getAllTwilioPhoneNumbers = catchAsync(
  async (req: Request, res: Response) => {
    const result = await TwilioPhoneNumberService.getAllTwilioPhoneNumbersFromDB(req.query);

    sendResponse(res, {
      statusCode: status.OK,
      message: "Twilio phone numbers retrieved successfully!",
      data: result.data,
      meta: result.meta // Include pagination metadata
    });
  }
);

const fetchAndStoreAvailableNumbers = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await TwilioPhoneNumberService.fetchAndStoreAvailableNumbers();
    sendResponse(res, {
      statusCode: status.OK,
      message: "Twilio phone number retrieved successfully!",
      data: result,
    });
  }
);

const getSingleTwilioPhoneNumber = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result =
      await TwilioPhoneNumberService.getSingleTwilioPhoneNumberFromDB(id);

    sendResponse(res, {
      statusCode: status.OK,
      message: "Twilio phone number retrieved successfully!",
      data: result,
    });
  }
);

// ============ SUPER ADMIN CONTROLLERS ============

const getAllNumbersForAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await TwilioPhoneNumberService.getAllNumbersForAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "All phone numbers retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllPhoneNumberRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await TwilioPhoneNumberService.getAllPhoneNumberRequests(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Phone number requests retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const updateRequestStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await TwilioPhoneNumberService.updateRequestStatus(
    req.params.id,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Request status updated successfully!",
    data: result,
  });
});

const togglePinNumber = catchAsync(async (req: Request, res: Response) => {
  const result = await TwilioPhoneNumberService.togglePinNumber(
    req.params.id,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: `Phone number ${result.isPinned ? 'pinned' : 'unpinned'} successfully!`,
    data: result,
  });
});

// ============ ORGANIZATION ADMIN CONTROLLERS ============

const getAvailableNumbersForOrg = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await TwilioPhoneNumberService.getAvailableNumbersForOrg(
    userId,
    req.query
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Available phone numbers retrieved successfully!",
    data: result,
  });
});

const requestPhoneNumber = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await TwilioPhoneNumberService.requestPhoneNumber(
    userId,
    req.body
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Phone number request submitted successfully!",
    data: result,
  });
});


export const TwilioPhoneNumberController = {
  // Super Admin
  getAllNumbersForAdmin,
  getAllPhoneNumberRequests,
  updateRequestStatus,
  togglePinNumber,
  
  // Organization Admin
  getAvailableNumbersForOrg,
  requestPhoneNumber,

  createTwilioPhoneNumber,
  getAllTwilioPhoneNumbers,
  getSingleTwilioPhoneNumber,
  fetchAndStoreAvailableNumbers,
};
