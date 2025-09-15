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

const getQuestionsByOrganization = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const result = await ToolsService.getQuestionsByOrganization(orgId, res);

  if (result) {
    sendResponse(res, {
      statusCode: status.OK,
      message: "Questions fetched successfully!",
      data: result,
    });
  }
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

const configureGoogleSheets = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const { spreadsheetId, credentials } = req.body;
  const user = req.user; // From auth middleware
  const result = await ToolsService.configureGoogleSheets(
    orgId,
    spreadsheetId,
    credentials,
    user
  );

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

export const ToolsController = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQaPairsToGoogleSheets,
  configureGoogleSheets,
};