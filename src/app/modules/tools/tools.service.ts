import status from "http-status";
import axios from "axios";

import ExcelJS from "exceljs";
import { google } from "googleapis";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import { Prisma } from "@prisma/client";

// Interface for Google Sheets credentials
interface GoogleSheetsCredentials {
  client_email: string;
  private_key: string;
}

const createHubSpotLead = async () => {
  const dummyData = {
    firstName: "S M HASAN",
    lastName: "JAMIL",
    email: "john.doe@example.com",
    phone: "+1234567890",
  };

  const hubspotPayload = {
    properties: {
      firstname: dummyData.firstName,
      lastname: dummyData.lastName,
      email: dummyData.email,
      phone: dummyData.phone,
    },
  };

  const hubspotApiKey = config.hubspot_api_key;
  if (!hubspotApiKey) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "HubSpot API key not configured"
    );
  }

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

const exportOrganizationData = async (organizationId: string, res: any) => {
  const organizations = await prisma.organization.findMany({
    where: { id: organizationId },
  });

  if (!organizations || organizations.length === 0) {
    throw new AppError(status.NOT_FOUND, "No organization found");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Organizations");

  const headers = Object.keys(organizations[0]);
  sheet.addRow(headers);

  const stringifyValue = (val: any): string => {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return val ?? "";
  };

  organizations.forEach((org) => {
    sheet.addRow(headers.map((key) => stringifyValue((org as any)[key])));
  });

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

  if (res) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Questions");

    const headers = Object.keys(questions[0]);
    sheet.addRow(headers);

    const stringifyValue = (val: any): string => {
      if (val instanceof Date) return val.toISOString();
      if (typeof val === "object" && val !== null) return JSON.stringify(val);
      return val ?? "";
    };

    questions.forEach((question) => {
      sheet.addRow(
        headers.map((key) => stringifyValue((question as any)[key]))
      );
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=questions-org-${organizationId}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
    return null;
  }

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

const configureGoogleSheets = async (
  orgId: string,
  spreadsheetId: string,
  credentials: GoogleSheetsCredentials,
  user: any // From auth middleware
) => {
  try {
    // Check if organization exists and verify user authorization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true },
    });
    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    // Authorization check: user must be organization_admin or super_admin
    if (
      !["organization_admin", "super_admin"].includes(user.role)
    ) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to configure Google Sheets for this organization"
      );
    }

    // Validate credentials by making a test API call
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    try {
      await sheets.spreadsheets.get({
        spreadsheetId,
      });
    } catch (error) {
      throw new AppError(
        status.BAD_REQUEST,
        "Invalid Google Sheets credentials or spreadsheet ID"
      );
    }

    // Save credentials and spreadsheet ID to the organization
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        googleSheetsSpreadsheetId: spreadsheetId,
        googleSheetsCredentials: credentials as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      message: "Google Sheets configuration saved successfully",
    };
  } catch (error: any) {
    console.error("Error configuring Google Sheets:", {
      message: error.message,
      stack: error.stack,
      orgId,
    });
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to configure Google Sheets: ${error.message}`
    );
  }
};

const addQaPairsToGoogleSheets = async (orgId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        googleSheetsSpreadsheetId: true,
        googleSheetsCredentials: true,
        lastSyncedAt: true,
      },
    });

    if (
      !organization ||
      !organization.googleSheetsSpreadsheetId ||
      !organization.googleSheetsCredentials
    ) {
      throw new AppError(
        status.BAD_REQUEST,
        "Google Sheets not configured for this organization"
      );
    }

    const credentials = organization.googleSheetsCredentials as unknown as GoogleSheetsCredentials;
    if (!credentials.client_email || !credentials.private_key) {
      throw new AppError(
        status.BAD_REQUEST,
        "Invalid Google Sheets credentials: client_email and private_key are required"
      );
    }

    const qaPairs = await prisma.qaPair.findMany({
      where: {
        org_id: orgId,
        createdAt: {
          gt: organization.lastSyncedAt || undefined,
        },
      },
      orderBy: { conv_id: "asc" },
    });

    if (!qaPairs || qaPairs.length === 0) {
      return {
        message: "No new Q&A pairs to sync for this organization",
        data: null,
      };
    }

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

    const groupedByConvId: { [key: string]: any[] } = {};
    qaPairs.forEach((qaPair) => {
      if (!groupedByConvId[qaPair.conv_id]) {
        groupedByConvId[qaPair.conv_id] = [];
      }
      groupedByConvId[qaPair.conv_id].push(qaPair);
    });

    const headers = ["conv_id", "question", "answer", "createdAt"];
    const values: any[][] = [];
    Object.keys(groupedByConvId).forEach((convId, index) => {
      if (index > 0) {
        values.push([""]);
      }
      values.push([`Call ID: ${convId}`]);
      values.push(headers);
      groupedByConvId[convId].forEach((qaPair) => {
        values.push([
          qaPair.conv_id,
          qaPair.question,
          qaPair.answer,
          qaPair.createdAt.toISOString(),
        ]);
      });
    });

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = organization.googleSheetsSpreadsheetId;

    const columnCount = headers.length;
    const lastColumn = getColumnLetter(columnCount);
    const range = `Sheet1!A1:${lastColumn}${values.length}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    await prisma.organization.update({
      where: { id: orgId },
      data: { lastSyncedAt: new Date() },
    });

    console.log(
      `Successfully added ${qaPairs.length} Q&A pairs for ${Object.keys(groupedByConvId).length} calls to Google Sheets for organization ${orgId}:`,
      response.data
    );
    return {
      message: `Successfully added ${qaPairs.length} Q&A pairs for ${Object.keys(groupedByConvId).length} calls`,
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
  configureGoogleSheets,
};