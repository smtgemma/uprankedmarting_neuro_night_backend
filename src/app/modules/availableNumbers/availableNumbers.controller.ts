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

const updateTwilioPhoneNumber = catchAsync(
  async (req: Request, res: Response) => {
    const { sid } = req.params;
    const result = await TwilioPhoneNumberService.updateTwilioPhoneNumberIntoDB(
      sid,
      req.body
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Twilio phone number updated successfully!",
      data: result,
    });
  }
);

const deleteTwilioPhoneNumber = catchAsync(
  async (req: Request, res: Response) => {
    const { sid } = req.params;
    await TwilioPhoneNumberService.deleteTwilioPhoneNumberFromDB(sid);

    sendResponse(res, {
      statusCode: status.OK,
      message: "Twilio phone number deleted successfully!",
    });
  }
);

export const TwilioPhoneNumberController = {
  createTwilioPhoneNumber,
  getAllTwilioPhoneNumbers,
  getSingleTwilioPhoneNumber,
  updateTwilioPhoneNumber,
  deleteTwilioPhoneNumber,
  fetchAndStoreAvailableNumbers,
};
