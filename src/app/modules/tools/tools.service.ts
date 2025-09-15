import status from "http-status";
import axios from "axios";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import config from "../../config";
import path from "path";
import ExcelJS from "exceljs";
import fs from "fs";
import { google } from "googleapis";
import sheetsapi from "../../utils/googlesheetsapi.json";

const createHubSpotLead = async () => {
  // Dummy data
  const dummyData = {
    firstName: "S M HASAN",
    lastName: "JAMIL",
    email: "john.doe@example.com",
    phone: "+1234567890",
  };

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

const getQuestionsByOrganization = async (
  organizationId: string,
  res?: any
) => {
  const questions = await prisma.question.findMany({
    where: {
      org_id: organizationId,
    },
  });

  if (!questions || questions.length === 0) {
    throw new AppError(
      status.NOT_FOUND,
      "No questions found for this organization"
    );
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
      sheet.addRow(
        headers.map((key) => stringifyValue((question as any)[key]))
      );
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

const getColumnLetter = (colIndex: number): string => {
  let letter = "";
  while (colIndex > 0) {
    const remainder = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
};

const addQaPairsToGoogleSheets = async (orgId: string) => {
  try {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    // Fetch QaPairs for the organization
    const qaPairs = await prisma.qaPair.findMany({
      where: { org_id: orgId },
    });

    if (!qaPairs || qaPairs.length === 0) {
      throw new AppError(
        status.NOT_FOUND,
        "No Q&A pairs found for this organization"
      );
    }

    // Validate QaPair data
    qaPairs.forEach((qaPair, index) => {
      if (!qaPair.question || qaPair.question.trim() === "") {
        throw new AppError(
          status.BAD_REQUEST,
          `Invalid Q&A pair at index ${index}: question is empty`
        );
      }
      if (!qaPair.answer || qaPair.answer.trim() === "") {
        throw new AppError(
          status.BAD_REQUEST,
          `Invalid Q&A pair at index ${index}: answer is empty`
        );
      }
      if (!qaPair.conv_id || qaPair.conv_id.trim() === "") {
        throw new AppError(
          status.BAD_REQUEST,
          `Invalid Q&A pair at index ${index}: conv_id is empty`
        );
      }
    });

    // Authenticate with Google Sheets API
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

    // Define headers explicitly (excluding updatedAt)
    const headers = [
      "id",
      "org_id",
      "conv_id",
      "question",
      "answer",
      "createdAt",
    ];
    const columnCount = headers.length;
    const lastColumn = getColumnLetter(columnCount);

    // Prepare data to append
    const values = qaPairs.map((qaPair) =>
      headers.map((key) => {
        const value = (qaPair as any)[key];
        if (value instanceof Date) return value.toISOString();
        return value ?? "";
      })
    );

    // Prepend headers to values
    values.unshift(headers);

    // Dynamic range based on number of columns
    const range = `Sheet1!A1:${lastColumn}${values.length}`;

    // Clear existing data in the range to avoid overlap
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    // Append data to Google Sheet
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    console.log(
      `Successfully added ${qaPairs.length} Q&A pairs to Google Sheets:`,
      response.data
    );
    return {
      message: `Successfully added ${qaPairs.length} Q&A pairs`,
      data: response.data,
    };
  } catch (error: any) {
    console.error("Error adding Q&A pairs to Google Sheets:", {
      message: error.message,
      stack: error.stack,
      orgId,
    });
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to add Q&A pairs to Google Sheets: ${error.message}`
    );
  }
};

export const ToolsService = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQaPairsToGoogleSheets,
};
