import status from "http-status";
import axios from "axios";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import config from "../../config";
import path from "path";
import ExcelJS from "exceljs";
import fs from "fs";
import { google } from "googleapis";
import sheetsapi from "../../utils/googlesheetsapi.json"

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

const getQuestionsByOrganization = async (organizationId: string, res?: any) => {
  const questions = await prisma.question.findMany({
    where: {
      org_id: organizationId,
    },
  });

  if (!questions || questions.length === 0) {
    throw new AppError(status.NOT_FOUND, "No questions found for this organization");
  }

  // If response object is provided, export to Excel
  if (res) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Questions");

    // Dynamically create headers from the first question object
    const headers = Object.keys(questions[0]);
    sheet.addRow(headers);

    // Helper function to stringify values
    const stringifyValue = (val: any): string => {
      if (val instanceof Date) return val.toISOString();
      if (typeof val === "object" && val !== null) return JSON.stringify(val);
      return val ?? "";
    };

    // Add all questions
    questions.forEach((question) => {
      sheet.addRow(headers.map((key) => stringifyValue((question as any)[key])));
    });

    // Set response headers for Excel download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=questions-org-${organizationId}.xlsx`
    );

    // Stream the Excel file
    await workbook.xlsx.write(res);
    res.end();
    return null; // Return null since the response is handled
  }

  // If no response object, return the questions data
  return questions;
};



// const addQuestionToGoogleSheets = async (orgId: string) => {
//   try {
//     // Fetch questions for the organization
//     const questions = await prisma.question.findMany({
//       where: { org_id: orgId },
//     });

//     if (!questions || questions.length === 0) {
//       throw new AppError(status.NOT_FOUND, "No questions found for this organization");
//     }

//     // Authenticate with Google Sheets API using service account JSON
//     const auth = new google.auth.GoogleAuth({
//       credentials: sheetsapi,
//       scopes: ["https://www.googleapis.com/auth/spreadsheets"],
//     });

//     const sheets = google.sheets({ version: "v4", auth });

//     const spreadsheetId = config.google_sheets_spreadsheet_id;
//     if (!spreadsheetId) {
//       throw new AppError(
//         status.INTERNAL_SERVER_ERROR,
//         "Google Sheets spreadsheet ID not configured"
//       );
//     }

//     // Prepare data to append
//     const values = questions.map((question) => [
//       question.id,
//       question.org_id,
//       question.question_text,
//       question.question_keywords.join(", "), // Join array for readable format
//       question.createdAt.toISOString(),
//       question.updatedAt.toISOString(),
//     ]);

//     // Append data to Google Sheet
//     const response = await sheets.spreadsheets.values.append({
//       spreadsheetId,
//       range: "Sheet1!A1:F", // Adjust range as needed
//       valueInputOption: "RAW",
//       requestBody: {
//         values,
//       },
//     });

//     console.log("Successfully added questions to Google Sheets:", response.data);
//     return response.data;
//   } catch (error) {
//     console.error("Error adding questions to Google Sheets:", error);
//     throw new AppError(
//       status.INTERNAL_SERVER_ERROR,
//       "Failed to add questions to Google Sheets"
//     );
//   }
// };

// Utility function to convert column number to letter (e.g., 1 -> A, 2 -> B, 6 -> F)
const getColumnLetter = (colIndex: number): string => {
  let letter = "";
  while (colIndex > 0) {
    const remainder = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
};


const addQuestionToGoogleSheets = async (orgId: string) => {
  try {
    // Fetch questions for the organization
    const questions = await prisma.question.findMany({
      where: { org_id: orgId },
    });

    if (!questions || questions.length === 0) {
      throw new AppError(status.NOT_FOUND, "No questions found for this organization");
    }

    // Authenticate with Google Sheets API using service account JSON
    const auth = new google.auth.GoogleAuth({
      credentials: sheetsapi,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = config.google_sheets_spreadsheet_id;
    if (!spreadsheetId) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        "Google Sheets spreadsheet ID not configured"
      );
    }

    // Get headers dynamically from the first question object
    const headers = Object.keys(questions[0]);
    const columnCount = headers.length;
    const lastColumn = getColumnLetter(columnCount); // Convert column count to letter (e.g., 6 -> F)

    // Prepare data to append
    const values = questions.map((question) =>
      headers.map((key) => {
        const value = (question as any)[key];
        if (Array.isArray(value)) return value.join(", "); // Handle arrays (e.g., question_keywords)
        if (value instanceof Date) return value.toISOString(); // Handle dates
        return value ?? ""; // Handle null/undefined
      })
    );

    // Dynamic range based on number of columns
    const range = `Sheet1!A1:${lastColumn}`;

    // Append data to Google Sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    console.log("Successfully added questions to Google Sheets:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error adding questions to Google Sheets:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to add questions to Google Sheets"
    );
  }
};

export const ToolsService = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQuestionToGoogleSheets,
};
