import status from "http-status";
import sendResponse from "../../utils/sendResponse";
import catchAsync from "../../utils/catchAsync";
import { ContactService } from "./contact.service";
import { Request, Response } from "express";

const sendContactForm = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.sendContactFormEmail(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

export const ContactController = {
  sendContactForm,
};
