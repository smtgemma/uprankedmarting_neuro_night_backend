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

// NEW: Get Google Sheets connect URL
const getGoogleSheetsConnectUrl = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await ToolsService.getGoogleSheetsConnectUrl(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: {
      authUrl: result.authUrl,
    },
  });
});

// NEW: Handle Google OAuth callback
const handleGoogleSheetsCallback = catchAsync(async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=missing_parameters`
    );
  }

  try {
    const result = await ToolsService.handleGoogleSheetsCallback(
      code as string,
      state as string
    );

    // Redirect to frontend with success message
    res.redirect(
      `${
        process.env.FRONTEND_URL
      // }/dashboard/integrations?success=google_sheets_connected&spreadsheetUrl=${encodeURIComponent(
      }/dashboard/organization/tools`
    );
  } catch (error: any) {
    console.error("Google Sheets callback error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/dashboard/organization/tools?error=connection_failed&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
});

// NEW: Disconnect Google Sheets
const disconnectGoogleSheets = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await ToolsService.disconnectGoogleSheets(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// NEW: Get Google Sheets status
const getGoogleSheetsStatus = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await ToolsService.getGoogleSheetsStatus(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Google Sheets status retrieved successfully",
    data: result,
  });
}); 

export const ToolsController = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQaPairsToGoogleSheets,
  getGoogleSheetsConnectUrl,
  handleGoogleSheetsCallback,
  disconnectGoogleSheets,
  getGoogleSheetsStatus,
};
