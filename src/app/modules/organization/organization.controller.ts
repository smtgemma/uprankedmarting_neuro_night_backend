import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { OrganizationServices } from "./organization.service";
import sendResponse from "../../utils/sendResponse";
import { Request, Response } from "express";
import pickOptions from "../../utils/pick";
import { User } from "@prisma/client";

const getAllOrganizations = catchAsync(async (req, res) => {
  const results = await OrganizationServices.getAllOrganizations();
  sendResponse(res, {
    statusCode: status.OK,
    message: "Organizations retrieved successfully",
    data: results?.data,
  });
});

const getOrganizationCallLogsManagement = catchAsync(
  async (req: Request, res: Response) => {
    const options = pickOptions(req.query, [
      "limit",
      "page",
      "sortBy",
      "sortOrder",
    ]);
    const filters = pickOptions(req.query, ["searchTerm", "agentType"]);

    const result = await OrganizationServices.getOrganizationCallLogsManagement(
      options,
      filters,
      req.user as User
    );

    sendResponse(res, {
      statusCode: status.OK,
      message: "Organization call logs retrieved successfully",
      data: result,
    });
  }
);

// In your controller
const getPlatformOverview = catchAsync(async (req: Request, res: Response) => {
  const stats = await OrganizationServices.getPlatformOverviewStats();
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Platform overview statistics fetched successfully!',
    data: stats,
  });
});

const getSingleOrganization = catchAsync(async (req, res) => {
  const { organizationId } = req.params;

  const result = await OrganizationServices.getSingleOrganization(
    organizationId
  );
  sendResponse(res, {
    statusCode: status.OK,
    message: "Organization retrieved successfully",
    data: result,
  });
});


const updateUsage = catchAsync(async (req, res) => {
  const { organizationId, recording_duration } = req.body;

  const result = await OrganizationServices.updateUsedMinutes(
    organizationId,
    recording_duration
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: "Subscription usage updated successfully",
    data: result,
  });
});

export const OrganizationController = {
  getAllOrganizations,
  updateUsage,
  getPlatformOverview,
  getSingleOrganization,
  getOrganizationCallLogsManagement
};
