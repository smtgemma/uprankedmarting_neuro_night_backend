import status from "http-status";
import axios from "axios";
import ExcelJS from "exceljs";
import { google } from "googleapis";

import { Prisma } from "@prisma/client";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";

// Interface for Google Sheets OAuth credentials
interface GoogleSheetsOAuthCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Interface for token response
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

// Create OAuth2 client instance
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    config.google_client_id,
    config.google_client_secret,
    config.google_redirect_uri
  );
};

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

// Generate Google OAuth URL for connecting Google Sheets
const getGoogleSheetsConnectUrl = async (orgId: string, user: any) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    if (!["organization_admin", "super_admin"].includes(user.role)) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to connect Google Sheets for this organization"
      );
    }

    const oauth2Client = createOAuth2Client();
    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: orgId,
      prompt: "consent",
    });

    return {
      authUrl,
      message: "Redirect user to this URL to connect Google Sheets",
    };
  } catch (error: any) {
    console.error("Error generating Google Sheets connect URL:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to generate connect URL: ${error.message}`
    );
  }
};

// Handle Google OAuth callback with Promise-based approach
const handleGoogleSheetsCallback = async (code: string, state: string) => {
  try {
    const orgId = state;

    if (!orgId) {
      throw new AppError(
        status.BAD_REQUEST,
        "Missing organization ID in callback"
      );
    }

    const oauth2Client = createOAuth2Client();

    // Use Promise-based approach instead of callback
    const tokenData = await new Promise<TokenResponse>((resolve, reject) => {
      oauth2Client.getToken(code, (error: any, tokens: any) => {
        if (error) {
          console.error("Error getting tokens:", error);
          reject(error);
        } else {
          resolve(tokens);
        }
      });
    });

    if (!tokenData || !tokenData.access_token || !tokenData.refresh_token) {
      throw new AppError(
        status.BAD_REQUEST,
        "Failed to get valid tokens from Google"
      );
    }

    // Set credentials for this session
    oauth2Client.setCredentials(tokenData);

    // Create a new spreadsheet for this organization
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    // const drive = google.drive({ version: "v3", auth: oauth2Client });  // Unused, can remove if not needed

    // Get organization name for spreadsheet title
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const spreadsheetTitle = `${
      organization?.name || "Organization"
    } - Q&A Pairs`;

    // Create new spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: spreadsheetTitle,
        },
        sheets: [
          {
            properties: {
              title: "Q&A Pairs",
            },
          },
        ],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        "Failed to create spreadsheet"
      );
    }

    // Add headers to the spreadsheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Q&A Pairs!A1:D1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Conversation ID", "Question", "Answer", "Created At"]],
      },
    });

    // Store OAuth credentials and spreadsheet info in database
    const credentials: GoogleSheetsOAuthCredentials = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expiry_date || Date.now() + 3600 * 1000,
    };

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        googleSheetsSpreadsheetId: spreadsheetId,
        googleSheetsCredentials:
          credentials as unknown as Prisma.InputJsonValue,
        lastSyncedAt: null,  // Explicitly set to null to ensure initial sync fetches all data
      },
    });

    // NEW: Immediately sync existing Q&A pairs after creation (dynamic fetch by orgId)
    const syncResult = await addQaPairsToGoogleSheets(orgId);
    console.log(`Initial sync after sheet creation: ${syncResult.message}`);

    return {
      message: "Google Sheets connected and initial data synced successfully!",
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error: any) {
    console.error("Error handling Google Sheets callback:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to connect Google Sheets: ${error.message}`
    );
  }
};

// Refresh access token when needed
const refreshAccessToken = async (
  refreshToken: string
): Promise<{ access_token: string; expires_at: number }> => {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Use Promise-based approach for refresh
    const tokenData = await new Promise<TokenResponse>((resolve, reject) => {
      oauth2Client.refreshAccessToken((error: any, tokens: any) => {
        if (error) {
          console.error("Error refreshing tokens:", error);
          reject(error);
        } else {
          resolve(tokens);
        }
      });
    });

    if (!tokenData.access_token) {
      throw new Error("Failed to refresh access token");
    }

    return {
      access_token: tokenData.access_token,
      expires_at: tokenData.expiry_date || Date.now() + 3600 * 1000,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new AppError(
      status.UNAUTHORIZED,
      "Failed to refresh Google Sheets access token"
    );
  }
};

// Updated function to use OAuth credentials
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
        "Google Sheets not connected for this organization. Please connect Google Sheets first."
      );
    }

    const credentials =
      organization.googleSheetsCredentials as unknown as GoogleSheetsOAuthCredentials;

    // Check if access token is expired and refresh if needed
    let accessToken = credentials.access_token;
    let refreshToken = credentials.refresh_token;

    if (credentials.expires_at < Date.now()) {
      if (!refreshToken) {
        throw new AppError(
          status.UNAUTHORIZED,
          "Google Sheets connection expired. Please reconnect Google Sheets."
        );
      }

      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;

      // Update credentials in database
      const updatedCredentials: GoogleSheetsOAuthCredentials = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: refreshed.expires_at,
      };

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          googleSheetsCredentials:
            updatedCredentials as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (!accessToken) {
      throw new AppError(
        status.UNAUTHORIZED,
        "Invalid access token. Please reconnect Google Sheets."
      );
    }

    // Set up OAuth client with current credentials
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

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

    // Validate Q&A pairs
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

    // Group by conversation ID
    const groupedByConvId: { [key: string]: any[] } = {};
    qaPairs.forEach((qaPair) => {
      if (!groupedByConvId[qaPair.conv_id]) {
        groupedByConvId[qaPair.conv_id] = [];
      }
      groupedByConvId[qaPair.conv_id].push(qaPair);
    });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const spreadsheetId = organization.googleSheetsSpreadsheetId;

    // Get current data to append new data instead of clearing
    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Q&A Pairs!A:D",
    });

    const existingRows = existingDataResponse.data.values || [];

    // Prepare new values to append
    const newValues: any[][] = [];
    Object.keys(groupedByConvId).forEach((convId, index) => {
      if (existingRows.length > 1 || index > 0) {
        newValues.push([""]);
      }

      newValues.push([`Call ID: ${convId}`]);

      groupedByConvId[convId].forEach((qaPair) => {
        newValues.push([
          qaPair.conv_id,
          qaPair.question,
          qaPair.answer,
          qaPair.createdAt.toISOString(),
        ]);
      });
    });

    // Append new data
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Q&A Pairs!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: newValues,
      },
    });

    // Update last synced time
    await prisma.organization.update({
      where: { id: orgId },
      data: { lastSyncedAt: new Date() },
    });

    console.log(
      `Successfully added ${qaPairs.length} Q&A pairs for ${
        Object.keys(groupedByConvId).length
      } calls to Google Sheets for organization ${orgId}`
    );

    return {
      message: `Successfully added ${qaPairs.length} Q&A pairs for ${
        Object.keys(groupedByConvId).length
      } calls`,
      data: response.data,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
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

// Disconnect Google Sheets
const disconnectGoogleSheets = async (orgId: string, user: any) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    if (!["organization_admin", "super_admin"].includes(user.role)) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to disconnect Google Sheets for this organization"
      );
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        googleSheetsSpreadsheetId: null,
        googleSheetsCredentials: null,
        lastSyncedAt: null,
      },
    });

    return {
      message: "Google Sheets disconnected successfully",
    };
  } catch (error: any) {
    console.error("Error disconnecting Google Sheets:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to disconnect Google Sheets: ${error.message}`
    );
  }
};

// Get Google Sheets connection status
const getGoogleSheetsStatus = async (orgId: string, user: any) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        ownerId: true,
        googleSheetsSpreadsheetId: true,
        googleSheetsCredentials: true,
        lastSyncedAt: true,
      },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    if (!["organization_admin", "super_admin"].includes(user.role)) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to view Google Sheets status for this organization"
      );
    }

    const isConnected = !!(
      organization.googleSheetsSpreadsheetId &&
      organization.googleSheetsCredentials
    );

    return {
      isConnected,
      spreadsheetId: organization.googleSheetsSpreadsheetId,
      spreadsheetUrl: organization.googleSheetsSpreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${organization.googleSheetsSpreadsheetId}/edit`
        : null,
      lastSyncedAt: organization.lastSyncedAt,
    };
  } catch (error: any) {
    console.error("Error getting Google Sheets status:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to get Google Sheets status: ${error.message}`
    );
  }
};

export const ToolsService = {
  createHubSpotLead,
  exportOrganizationData,
  getQuestionsByOrganization,
  addQaPairsToGoogleSheets,
  getGoogleSheetsConnectUrl,
  handleGoogleSheetsCallback,
  disconnectGoogleSheets,
  getGoogleSheetsStatus,
};
