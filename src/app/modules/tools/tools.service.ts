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

// Interface for HubSpot OAuth credentials
interface HubSpotOAuthCredentials {
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

const createHubSpotLead = async (leadData: any) => {
  const hubspotPayload = {
    properties: {
      firstname: leadData.firstName,
      lastname: leadData.lastName,
      email: leadData.email,
      phone: leadData.phone,
      company: leadData.company || "",
      jobtitle: leadData.jobTitle || "",
      website: leadData.website || "",
      city: leadData.city || "",
      state: leadData.state || "",
      country: leadData.country || "",
      lifecyclestage: leadData.lifecycleStage || "lead",
      hs_lead_status: leadData.leadStatus || "NEW"
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
      email: leadData.email,
      properties: response.data.properties
    };
  } catch (error: any) {
    console.error("Error creating HubSpot lead:", error.response?.data || error.message);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to create HubSpot lead: ${error.response?.data?.message || error.message}`
    );
  }
};

// Generate HubSpot OAuth URL for connecting HubSpot
const getHubSpotConnectUrl = async (orgId: string, user: any) => {
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
        "You are not authorized to connect HubSpot for this organization"
      );
    }

    const scopes = [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.companies.read",
      "crm.objects.companies.write",
      "crm.objects.deals.read", 
      "crm.objects.deals.write",
      "crm.lists.read",
      "crm.lists.write"
    ];

    const hubspotClientId = config.hubspot_client_id;
    const redirectUri = config.hubspot_redirect_uri;

    if (!hubspotClientId || !redirectUri) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        "HubSpot OAuth configuration missing"
      );
    }

    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${hubspotClientId}&scope=${scopes.join('%20')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${orgId}`;

    return {
      authUrl,
      message: "Redirect user to this URL to connect HubSpot",
    };
  } catch (error: any) {
    console.error("Error generating HubSpot connect URL:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to generate connect URL: ${error.message}`
    );
  }
};

// Handle HubSpot OAuth callback
const handleHubSpotCallback = async (code: string, state: string) => {
  try {
    const orgId = state;

    if (!orgId) {
      throw new AppError(
        status.BAD_REQUEST,
        "Missing organization ID in callback"
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      {
        grant_type: "authorization_code",
        client_id: config.hubspot_client_id,
        client_secret: config.hubspot_client_secret,
        redirect_uri: config.hubspot_redirect_uri,
        code: code,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokenData = tokenResponse.data;

    if (!tokenData || !tokenData.access_token || !tokenData.refresh_token) {
      throw new AppError(
        status.BAD_REQUEST,
        "Failed to get valid tokens from HubSpot"
      );
    }

    // Store HubSpot credentials in database
    const credentials: HubSpotOAuthCredentials = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000), // Convert to timestamp
    };

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        hubspotAccessToken: credentials.access_token,
        hubspotRefreshToken: credentials.refresh_token,
        hubspotExpiresAt: new Date(credentials.expires_at),
        lastHubSpotSyncedAt: null, // Reset to ensure initial sync fetches all data
      },
    });

    // Immediately sync existing Q&A pairs after connection
    const syncResult = await addQaPairsToHubSpot(orgId);
    console.log(`Initial HubSpot sync after connection: ${syncResult.message}`);

    return {
      message: "HubSpot connected and initial data synced successfully!",
      hubspotPortalId: tokenData.hub_id,
      syncedData: syncResult.data
    };
  } catch (error: any) {
    console.error("Error handling HubSpot callback:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to connect HubSpot: ${error.response?.data?.message || error.message}`
    );
  }
};

// Refresh HubSpot access token when needed
const refreshHubSpotAccessToken = async (
  refreshToken: string
): Promise<{ access_token: string; expires_at: number }> => {
  try {
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      {
        grant_type: "refresh_token",
        client_id: config.hubspot_client_id,
        client_secret: config.hubspot_client_secret,
        refresh_token: refreshToken,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokenData = response.data;

    if (!tokenData.access_token) {
      throw new Error("Failed to refresh HubSpot access token");
    }

    return {
      access_token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
    };
  } catch (error: any) {
    console.error("Error refreshing HubSpot access token:", error);
    throw new AppError(
      status.UNAUTHORIZED,
      `Failed to refresh HubSpot access token: ${error.response?.data?.message || error.message}`
    );
  }
};

// Add Q&A pairs to HubSpot as contacts with custom properties
const addQaPairsToHubSpot = async (orgId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        hubspotAccessToken: true,
        hubspotRefreshToken: true,
        hubspotExpiresAt: true,
        lastHubSpotSyncedAt: true,
        name: true,
        industry: true,
        websiteLink: true,
      },
    });

    if (
      !organization ||
      !organization.hubspotAccessToken ||
      !organization.hubspotRefreshToken
    ) {
      throw new AppError(
        status.BAD_REQUEST,
        "HubSpot not connected for this organization. Please connect HubSpot first."
      );
    }

    // Check if access token is expired and refresh if needed
    let accessToken = organization.hubspotAccessToken;
    let refreshToken = organization.hubspotRefreshToken;

    if (organization.hubspotExpiresAt && organization.hubspotExpiresAt.getTime() < Date.now()) {
      if (!refreshToken) {
        throw new AppError(
          status.UNAUTHORIZED,
          "HubSpot connection expired. Please reconnect HubSpot."
        );
      }

      const refreshed = await refreshHubSpotAccessToken(refreshToken);
      accessToken = refreshed.access_token;

      // Update credentials in database
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          hubspotAccessToken: accessToken,
          hubspotExpiresAt: new Date(refreshed.expires_at),
        },
      });
    }

    if (!accessToken) {
      throw new AppError(
        status.UNAUTHORIZED,
        "Invalid access token. Please reconnect HubSpot."
      );
    }

    const qaPairs = await prisma.qaPair.findMany({
      where: {
        org_id: orgId,
        createdAt: {
          gt: organization.lastHubSpotSyncedAt || undefined,
        },
      },
      orderBy: { conv_id: "asc" },
    });

    if (!qaPairs || qaPairs.length === 0) {
      return {
        message: "No new Q&A pairs to sync to HubSpot for this organization",
        data: {
          contactsCreated: 0,
          totalConversations: 0,
          totalQaPairs: 0,
          contacts: []
        },
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

    const createdContacts = [];

    // Create a contact for each conversation
    for (const [convId, pairs] of Object.entries(groupedByConvId)) {
      try {
        // Prepare the questions and answers as a formatted string
        const qaContent = pairs.map((pair, index) => 
          `Q${index + 1}: ${pair.question}\nA${index + 1}: ${pair.answer}`
        ).join('\n\n');

        // Create a safe domain from organization name
        const orgDomain = organization.name?.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'organization';

        const contactPayload = {
          properties: {
            // Standard properties
            firstname: "Call",
            lastname: convId,
            email: `call-${convId}@${orgDomain}.local`,
            
            // Custom properties
            conversation_id: convId,
            qa_content: qaContent.substring(0, 65536), // HubSpot text field limit
            call_date: pairs[0].createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
            total_qa_pairs: pairs.length.toString(),
            organization_name: organization.name || 'Unknown Organization',
            organization_industry: organization.industry || '',
            organization_website: organization.websiteLink || '',
            
            // Additional metadata
            lifecyclestage: 'other',
            hs_lead_status: 'NEW',
            source: 'Call Center Integration',
            
            // Add first question and answer as separate fields for easier searching
            first_question: pairs[0]?.question?.substring(0, 500) || '',
            first_answer: pairs[0]?.answer?.substring(0, 500) || '',
            
            // Add timestamp for sorting
            call_timestamp: pairs[0].createdAt.toISOString()
          }
        };

        const response = await axios.post(
          "https://api.hubapi.com/crm/v3/objects/contacts",
          contactPayload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        createdContacts.push({
          convId,
          hubspotContactId: response.data.id,
          qaPairsCount: pairs.length,
          email: contactPayload.properties.email,
          createdAt: pairs[0].createdAt
        });

        console.log(`Created HubSpot contact for conversation ${convId} with ID ${response.data.id}`);

      } catch (error: any) {
        console.error(`Error creating HubSpot contact for conversation ${convId}:`, error.response?.data || error.message);
        
        // Log but continue with other conversations
        if (error.response?.status === 409) {
          console.log(`Contact for conversation ${convId} might already exist, skipping...`);
        } else if (error.response?.status === 400) {
          console.error(`Invalid data for conversation ${convId}:`, error.response.data);
        }
      }
    }

    // Update last synced time
    await prisma.organization.update({
      where: { id: orgId },
      data: { lastHubSpotSyncedAt: new Date() },
    });

    console.log(
      `Successfully created ${createdContacts.length} HubSpot contacts for ${
        Object.keys(groupedByConvId).length
      } conversations from organization ${orgId}`
    );

    return {
      message: `Successfully created ${createdContacts.length} HubSpot contacts for ${
        Object.keys(groupedByConvId).length
      } conversations with ${qaPairs.length} Q&A pairs total`,
      data: {
        contactsCreated: createdContacts.length,
        totalConversations: Object.keys(groupedByConvId).length,
        totalQaPairs: qaPairs.length,
        contacts: createdContacts,
        organizationName: organization.name,
        syncedAt: new Date().toISOString()
      },
    };
  } catch (error: any) {
    console.error("Error adding Q&A pairs to HubSpot:", {
      message: error.message,
      stack: error.stack,
      orgId,
    });
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to add Q&A pairs to HubSpot: ${error.message}`
    );
  }
};

// Disconnect HubSpot
const disconnectHubSpot = async (orgId: string, user: any) => {
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
        "You are not authorized to disconnect HubSpot for this organization"
      );
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        hubspotAccessToken: null,
        hubspotRefreshToken: null,
        hubspotExpiresAt: null,
        lastHubSpotSyncedAt: null,
      },
    });

    return {
      message: "HubSpot disconnected successfully",
    };
  } catch (error: any) {
    console.error("Error disconnecting HubSpot:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to disconnect HubSpot: ${error.message}`
    );
  }
};

// Get HubSpot connection status
const getHubSpotStatus = async (orgId: string, user: any) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        ownerId: true,
        hubspotAccessToken: true,
        hubspotRefreshToken: true,
        hubspotExpiresAt: true,
        lastHubSpotSyncedAt: true,
        name: true,
      },
    });

    if (!organization) {
      throw new AppError(status.NOT_FOUND, "Organization not found");
    }

    if (!["organization_admin", "super_admin"].includes(user.role)) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to view HubSpot status for this organization"
      );
    }

    const isConnected = !!(
      organization.hubspotAccessToken &&
      organization.hubspotRefreshToken
    );

    const isTokenExpired = organization.hubspotExpiresAt ? 
      organization.hubspotExpiresAt.getTime() < Date.now() : false;

    return {
      isConnected,
      isTokenExpired,
      expiresAt: organization.hubspotExpiresAt,
      lastSyncedAt: organization.lastHubSpotSyncedAt,
      organizationName: organization.name,
    };
  } catch (error: any) {
    console.error("Error getting HubSpot status:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to get HubSpot status: ${error.message}`
    );
  }
};

// Export organization data to Excel
const exportOrganizationData = async (organizationId: string, res: any) => {
  try {
    const organizations = await prisma.organization.findMany({
      where: { id: organizationId },
      include: {
        ownedOrganization: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    if (!organizations || organizations.length === 0) {
      throw new AppError(status.NOT_FOUND, "No organization found");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Organizations");

    // Create dynamic headers based on actual data
    const org = organizations[0];
    const headers = Object.keys(org).filter(key => 
      key !== 'googleSheetsCredentials' && // Exclude sensitive data
      key !== 'hubspotAccessToken' &&
      key !== 'hubspotRefreshToken'
    );
    
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
      `attachment; filename=org-${organizationId}-${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error("Error exporting organization data:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to export organization data: ${error.message}`
    );
  }
};

const getQuestionsByOrganization = async (
  organizationId: string,
  res?: any
) => {
  try {
    const questions = await prisma.question.findMany({
      where: {
        org_id: organizationId,
      },
      include: {
        organization: {
          select: {
            name: true,
          }
        }
      }
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

      // Create dynamic headers
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

      const orgName = questions[0].organization?.name || 'organization';
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=questions-${orgName}-${new Date().toISOString().split('T')[0]}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
      return null;
    }

    return questions;
  } catch (error: any) {
    console.error("Error getting questions by organization:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to get questions: ${error.message}`
    );
  }
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

// Handle Google OAuth callback
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

    oauth2Client.setCredentials(tokenData);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Get organization name for spreadsheet title
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const spreadsheetTitle = `${organization?.name || "Organization"} - Q&A Pairs - ${new Date().toISOString().split('T')[0]}`;

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
        lastSyncedAt: null,
      },
    });

    // Immediately sync existing Q&A pairs after creation
    const syncResult = await addQaPairsToGoogleSheets(orgId);
    console.log(`Initial sync after sheet creation: ${syncResult.message}`);

    return {
      message: "Google Sheets connected and initial data synced successfully!",
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedData: syncResult.data
    };
  } catch (error: any) {
    console.error("Error handling Google Sheets callback:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to connect Google Sheets: ${error.message}`
    );
  }
};

// Refresh Google Sheets access token
const refreshAccessToken = async (
  refreshToken: string
): Promise<{ access_token: string; expires_at: number }> => {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

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

// Add Q&A pairs to Google Sheets
const addQaPairsToGoogleSheets = async (orgId: string) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
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
      orderBy: [
        { conv_id: "asc" },
        { createdAt: "asc" }
      ],
    });

    if (!qaPairs || qaPairs.length === 0) {
      return {
        message: "No new Q&A pairs to sync for this organization",
        data: {
          rowsAdded: 0,
          conversationsProcessed: 0,
          totalQaPairs: 0,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${organization.googleSheetsSpreadsheetId}/edit`
        },
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

      // Add conversation header
      newValues.push([`Call ID: ${convId} | Organization: ${organization.name || 'Unknown'} | Date: ${groupedByConvId[convId][0].createdAt.toISOString().split('T')[0]}`]);

      // Add Q&A pairs for this conversation
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
      } calls to Google Sheets for organization ${organization.name || orgId}`
    );

    return {
      message: `Successfully added ${qaPairs.length} Q&A pairs for ${
        Object.keys(groupedByConvId).length
      } conversations`,
      data: {
        rowsAdded: newValues.length,
        conversationsProcessed: Object.keys(groupedByConvId).length,
        totalQaPairs: qaPairs.length,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        organizationName: organization.name,
        syncedAt: new Date().toISOString()
      },
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
      select: { id: true, ownerId: true, name: true },
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

    console.log(`Google Sheets disconnected for organization: ${organization.name || orgId}`);

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
        name: true,
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
      organizationName: organization.name,
    };
  } catch (error: any) {
    console.error("Error getting Google Sheets status:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to get Google Sheets status: ${error.message}`
    );
  }
};



// Temporary function to reset sync timestamps for testing
const resetSyncTimestamps = async (orgId: string) => {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      lastHubSpotSyncedAt: new Date('2025-09-01T00:00:00.000Z'), // Before your Q&A creation date
      lastSyncedAt: new Date('2025-09-01T00:00:00.000Z'), // For Google Sheets
    },
  });
  return { message: "Sync timestamps reset successfully" };
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
  // HubSpot functions
  getHubSpotConnectUrl,
  handleHubSpotCallback,
  addQaPairsToHubSpot,
  disconnectHubSpot,
  getHubSpotStatus,
  refreshHubSpotAccessToken, // Export for external use if needed
  resetSyncTimestamps,
};