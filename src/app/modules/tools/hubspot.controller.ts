// import status from "http-status";
// import catchAsync from "../../utils/catchAsync";
// import sendResponse from "../../utils/sendResponse";
// import { HubSpotService } from "./hubspot.service";
// import AppError from "../../errors/AppError";
// import prisma from "../../utils/prisma";


// const getHubSpotConnectUrl = catchAsync(async (req, res) => {
//   const { orgId } = req.params;
//   const user = req.user;
//   const result = await HubSpotService.getHubSpotConnectUrl(orgId, user);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: result.message,
//     data: { authUrl: result.authUrl },
//   });
// });

// const handleHubSpotCallback = catchAsync(async (req, res) => {
//   const { code, state } = req.query;
//   if (!code || !state) {
//     return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=missing`);
//   }

//   try {
//     await HubSpotService.handleHubSpotCallback(
//       code as string,
//       state as string
//     );
//     res.redirect(`${process.env.FRONTEND_URL}/dashboard/organization/tools`);
//   } catch (error: any) {
//     res.redirect(
//       `${process.env.FRONTEND_URL}/dashboard/organization/tools?error=${encodeURIComponent(
//         error.message
//       )}`
//     );
//   }
// });


// const getHubSpotStatus = catchAsync(async (req, res) => {
//   const { orgId } = req.params;
//   const user = req.user;
//   const result = await HubSpotService.getHubSpotStatus(orgId, user);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "HubSpot status retrieved successfully",
//     data: result,
//   });
// });

// const disconnectHubSpot = catchAsync(async (req, res) => {
//   const { orgId } = req.params;
//   const user = req.user;
//   const result = await HubSpotService.disconnectHubSpot(orgId, user);

//   sendResponse(res, {
//     statusCode: status.OK,
//     message: result.message,
//     data: null,
//   });
// });


// export const HubSpotController = {
//   getHubSpotConnectUrl,
//   handleHubSpotCallback,
//   getHubSpotStatus,
//   disconnectHubSpot,
// };

//! try - 1

import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { HubSpotService } from "./hubspot.service";
import sendResponse from "../../utils/sendResponse";

const getHubSpotConnectUrl = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await HubSpotService.getHubSpotConnectUrl(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: { authUrl: result.authUrl },
  });
});

// const handleHubSpotCallback = catchAsync(async (req, res) => {
//   const { code, state } = req.query;
  
//   console.log("HubSpot callback query params:", { code, state }); // Debug log
//   if (!code || !state) {
//     console.error("Missing parameters in HubSpot callback:", { code, state });
//     return res.redirect(
//       `http://localhost:3000/dashboard/organization/tools?error=missing_parameters`
//     );
//   }

//   try {
//     const result = await HubSpotService.handleHubSpotCallback(code as string, state as string);
//     res.redirect(
//       `http://localhost:3000/dashboard/organization/tools?success=hubspot_connected`
//     );
//   } catch (error: any) {
//     console.error("HubSpot callback error:", error.response?.data || error.message);
//     res.redirect(
//       `http://localhost:3000/dashboard/organization/tools?error=connection_failed&message=${encodeURIComponent(error.message)}`
//     );
//   }
// });


const handleHubSpotCallback = catchAsync(async (req, res) => {
  const { code, state } = req.query;
  console.log("HubSpot callback query params:", { code, state });
  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=missing`);
  }

  try {
    await HubSpotService.handleHubSpotCallback(
      code as string,
      state as string
    );
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/organization/tools`);
  } catch (error: any) {
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard/organization/tools?error=${encodeURIComponent(
        error.message
      )}`
    );
  }
});

const addQaPairsToHubSpot = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const result = await HubSpotService.addQaPairsToHubSpot(orgId);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: result.message,
    data: null,
  });
});

const getHubSpotStatus = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await HubSpotService.getHubSpotStatus(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: "HubSpot status retrieved successfully",
    data: result,
  });
});

const disconnectHubSpot = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const user = req.user;
  const result = await HubSpotService.disconnectHubSpot(orgId, user);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

export const HubSpotController = {
  getHubSpotConnectUrl,
  handleHubSpotCallback,
  addQaPairsToHubSpot,
  getHubSpotStatus,
  disconnectHubSpot,
};
