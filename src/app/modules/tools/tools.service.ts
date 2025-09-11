import status from "http-status";
import axios from "axios";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import config from "../../config";
import path from "path";
import ExcelJS from "exceljs";
import fs from "fs";

// interface CreateLeadPayload {
//   organizationId: string;
// }

// const createHubSpotLead = async (payload: CreateLeadPayload) => {
//   const { organizationId } = payload;

//   // 1. Fetch organization and subscription data
//   const organization = await prisma.organization.findUnique({
//     where: { id: organizationId },
//     select: {
//       name: true,
//     //   organizationEmail: true,
//       subscriptions: {
//         take: 1,
//         orderBy: { createdAt: "desc" },
//         select: { purchasedNumber: true },
//       },
//     },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   const subscription = organization.subscriptions[0];
//   if (!subscription || !subscription.purchasedNumber) {
//     throw new AppError(status.NOT_FOUND, "No active subscription with phone number found");
//   }

//   // 2. Prepare HubSpot payload
//   const [firstName, ...lastNameParts] = organization.name.split(" ");
//   const lastName = lastNameParts.join(" ") || "Unknown"; // Fallback if no last name
//   const hubspotPayload = {
//     properties: {
//       firstname: firstName || "Unknown",
//       lastname: lastName,
//     //   email: organization.organizationEmail,
//       phone: subscription.purchasedNumber,
//     },
//   };

//   // 3. Send POST request to HubSpot
//   const hubspotApiKey = config.hubspot_api_key;
//   if (!hubspotApiKey) {
//     throw new AppError(status.INTERNAL_SERVER_ERROR, "HubSpot API key not configured");
//   }

//   try {
//     const response = await axios.post(
//       "https://api.hubapi.com/crm/v3/objects/contacts",
//       hubspotPayload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${hubspotApiKey}`,
//         },
//       }
//     );
//     console.log("Successfully created HubSpot lead:", response.data);

//     return {
//       hubspotContactId: response.data.id,
//       organizationId,
//     //   email: organization.organizationEmail,
//     };
//   } catch (error) {
//     console.error("Error creating HubSpot lead:", error);
//     throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create HubSpot lead");
//   }
// };

// export const ToolsService = {
//   createHubSpotLead,
// };

const createHubSpotLead = async () => {
  // Dummy data
  const dummyData = {
    firstName: "S M HASAN",
    lastName: "JAMIL",
    email: "john.doe@example.com",
    phone: "+1234567890",
  };

  // // Split name into first and last names
  // const [firstName, ...lastNameParts] = dummyData.name.split(" ");
  // const lastName = lastNameParts.join(" ") || "Unknown";

  // Prepare HubSpot payload
  const hubspotPayload = {
    properties: {
      firstname: dummyData.firstName,
      lastname: dummyData.lastName,
      email: dummyData.email,
      phone: dummyData.phone,
    },
  };

  // Get HubSpot API key from environment
  const hubspotApiKey = config.hubspot_api_key;
  if (!hubspotApiKey) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "HubSpot API key not configured"
    );
  }

  // Send POST request to HubSpot
  try {
    const response = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      hubspotPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hubspotApiKey}`,
        },
      }
    );
    console.log("Successfully created HubSpot lead:", response.data);

    return {
      hubspotContactId: response.data.id,
      email: dummyData.email,
    };
  } catch (error) {
    console.error("Error creating HubSpot lead:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to create HubSpot lead"
    );
  }
};

// =======================================

const exportOrganizationData = async (organizationId: string, res: any) => {
  // 1. Fetch all organizations matching this ID
  const organizations = await prisma.organization.findMany({
    where: { id: organizationId },
  });

  if (!organizations || organizations.length === 0) {
    throw new AppError(status.NOT_FOUND, "No organization found");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Organizations");

  // 2. Dynamically create headers
  const headers = Object.keys(organizations[0]);
  sheet.addRow(headers);

  // helper function to stringify values
  const stringifyValue = (val: any): string => {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return val ?? "";
  };

  // 3. Add all organizations
  organizations.forEach((org) => {
    sheet.addRow(headers.map((key) => stringifyValue((org as any)[key])));
  });

  // 4. Stream file
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=org-${organizationId}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
};

const getQuestionsByOrganization = async (organizationId: string) => {
  const questions = await prisma.question.findMany({
    where: {
      org_id: organizationId,
    },
  });

  return questions;
};

export const ToolsService = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
};
