import { Request, Response } from "express";
import status from "http-status";
import { ClientManagementServices } from "./clientManagement.services";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";

const getAllOrganizationAdmins = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ClientManagementServices.getAllOrganizationAdmin(
      req.query
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Organization admins retrieved successfully!",
      data: result,
    });
  }
);


export const ClientManagementController = {
  getAllOrganizationAdmins
};
