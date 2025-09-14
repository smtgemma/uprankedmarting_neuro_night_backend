import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { ToolsService } from "./tools.service";
import sendResponse from "../../utils/sendResponse";

const createHubSpotLead = catchAsync(async (req, res) => {
  const result = await ToolsService.createHubSpotLead();

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Lead created in HubSpot successfully",
    data: result,
  });
});

const exportOrganizationData = catchAsync(async (req, res) => {
  const { organizationId } = req.params;
  await ToolsService.exportOrganizationData(organizationId, res);
});

// Get all questions by organization ID
const getQuestionsByOrganization = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const result = await ToolsService.getQuestionsByOrganization(orgId, res);

  // If result is not null, send JSON response (for fetch-only case)
  if (result) {
    sendResponse(res, {
      statusCode: status.OK,
      message: "Questions fetched successfully!",
      data: result,
    });
  }
  // If result is null, the response was handled by Excel export
});

const addQaPairsToGoogleSheets = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const result = await ToolsService.addQaPairsToGoogleSheets(orgId);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: result.message,
    data: result.data,
  });
});

export const ToolsController = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQaPairsToGoogleSheets,
};