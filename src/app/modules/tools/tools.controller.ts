import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { ToolsService } from "./tools.service";
import sendResponse from "../../utils/sendResponse";

// const createHubSpotLead = catchAsync(async (req, res) => {
//   const { organizationId } = req.body;

//   const result = await ToolsService.createHubSpotLead({ organizationId });

//   sendResponse(res, {
//     statusCode: status.CREATED,
//     message: "Lead created in HubSpot successfully",
//     data: result,
//   });
// });

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


const addQuestionToGoogleSheets = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const result = await ToolsService.addQuestionToGoogleSheets(orgId);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Questions added to Google Sheets successfully",
    data: result,
  });
});

export const ToolsController = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQuestionToGoogleSheets,
};