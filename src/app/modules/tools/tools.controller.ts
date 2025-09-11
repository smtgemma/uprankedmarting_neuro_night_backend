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
  const result = await ToolsService.getQuestionsByOrganization(orgId);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Questions fetched successfully!",
    data: result,
  });
});

export const ToolsController = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
};