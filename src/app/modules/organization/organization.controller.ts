import status from "http-status";
import catchAsync from "../../utils/catchAsync";
import { OrganizationServices } from "./organization.service";
import sendResponse from "../../utils/sendResponse";

const getAllOrganizations = catchAsync(async (req, res) => {
  const results = await OrganizationServices.getAllOrganizations();
  sendResponse(res, {
    statusCode: status.OK,
    message: "Organizations retrieved successfully",
    data: results.data,
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

// const createOrganization = catchAsync(async (req, res) => {
//   const result = await OrganizationServices.createOrganization(req.body);
//   sendResponse(res, {
//     statusCode: status.CREATED,
//     message: "Organization created successfully",
//     data: result,
//   });
// });

// const updateOrganization = catchAsync(async (req, res) => {
//   const { organizationId } = req.params;
//   const { id: userId, role: userRole } = req.user;

//   const result = await OrganizationServices.updateOrganization(organizationId, userId, userRole, req.body);
//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Organization updated successfully",
//     data: result,
//   });
// });

// const deleteOrganization = catchAsync(async (req, res) => {
//   const { organizationId } = req.params;
//   const { id: userId, role: userRole } = req.user;

//   const result = await OrganizationServices.deleteOrganization(organizationId, userId, userRole);
//   sendResponse(res, {
//     statusCode: status.OK,
//     message: "Organization deleted successfully",
//     data: result,
//   });
// });

export const OrganizationController = {
  getAllOrganizations,
  getSingleOrganization,
  //   createOrganization,
  //   updateOrganization,
  //   deleteOrganization,
};
