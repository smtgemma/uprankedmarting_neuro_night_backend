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

export const ToolsController = {
  createHubSpotLead,
};