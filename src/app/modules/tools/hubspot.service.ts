// import status from "http-status";
// import AppError from "../../errors/AppError";
// import prisma from "../../utils/prisma";
// import config from "../../config";
// import axios from "axios";


// interface HubSpotOAuthTokens {
//   access_token: string;
//   refresh_token: string;
//   expires_at: number;
// }

// // Generate HubSpot OAuth URL
// const getHubSpotConnectUrl = async (orgId: string, user: any) => {
//   const organization = await prisma.organization.findUnique({
//     where: { id: orgId },
//     select: { id: true, ownerId: true },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   if (!["organization_admin", "super_admin"].includes(user.role)) {
//     throw new AppError(
//       status.FORBIDDEN,
//       "You are not authorized to connect HubSpot for this organization"
//     );
//   }

//   const scopes = encodeURIComponent(config.hubspot_scopes as string); // যেমন: "crm.objects.contacts.write crm.objects.contacts.read"
//   const authUrl = `https://app-na2.hubspot.com/oauth/authorize?client_id=a39e0394-1a64-416d-956c-de2f77678db0&redirect_uri=http://localhost:5000/api/v1/tools/hubspot/callback&scope=oauth&optional_scope=crm.schemas.custom.read%20crm.objects.custom.read%20crm.objects.custom.write`;
//   // const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${config.hubspot_client_id}&redirect_uri=${encodeURIComponent(
//   //   config.hubspot_redirect_uri as string
//   // )}&scope=${scopes}&state=${orgId}`;

//   return {
//     authUrl,
//     message: "Redirect user to this URL to connect HubSpot",
//   };
// };



// // Handle HubSpot OAuth callback
// const handleHubSpotCallback = async (code: string, state: string) => {
//   const orgId = state;
//   if (!orgId) {
//     throw new AppError(status.BAD_REQUEST, "Missing organization ID");
//   }

//   try {
//     const tokenResponse = await axios.post(
//       "https://api.hubapi.com/oauth/v1/token",
//       new URLSearchParams({
//         grant_type: "authorization_code",
//         client_id: config.hubspot_client_id,
//         client_secret: config.hubspot_client_secret,
//         redirect_uri: config.hubspot_redirect_uri,
//         code,
//       } as any),
//       { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//     );

//     const { access_token, refresh_token, expires_in } = tokenResponse.data;

//     const credentials: HubSpotOAuthTokens = {
//       access_token,
//       refresh_token,
//       expires_at: Date.now() + expires_in * 1000,
//     };

//     await prisma.organization.update({
//       where: { id: orgId },
//       data: {
//         hubspotCredentials: credentials as any, // Json field in DB
//       },
//     });

//     return {
//       message: "HubSpot connected successfully!",
//     };
//   } catch (error: any) {
//     console.error("Error exchanging HubSpot token:", error);
//     throw new AppError(
//       status.INTERNAL_SERVER_ERROR,
//       `Failed to connect HubSpot: ${error.message}`
//     );
//   }
// };




// // Get HubSpot connection status
// const getHubSpotStatus = async (orgId: string, user: any) => {
//   const organization = await prisma.organization.findUnique({
//     where: { id: orgId },
//     select: {
//       hubspotCredentials: true,
//     },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   if (!["organization_admin", "super_admin"].includes(user.role)) {
//     throw new AppError(
//       status.FORBIDDEN,
//       "You are not authorized to view HubSpot status for this organization"
//     );
//   }

//   const isConnected = !!organization.hubspotCredentials;

//   return {
//     isConnected,
//   };
// };

// // Disconnect HubSpot
// const disconnectHubSpot = async (orgId: string, user: any) => {
//   const organization = await prisma.organization.findUnique({
//     where: { id: orgId },
//     select: { id: true },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   if (!["organization_admin", "super_admin"].includes(user.role)) {
//     throw new AppError(
//       status.FORBIDDEN,
//       "You are not authorized to disconnect HubSpot for this organization"
//     );
//   }

//   await prisma.organization.update({
//     where: { id: orgId },
//     data: {
//       hubspotCredentials: null,
//     },
//   });

//   return { message: "HubSpot disconnected successfully" };
// };

// export const HubSpotService = {
//   getHubSpotConnectUrl,
//   handleHubSpotCallback,
//   getHubSpotStatus,
//   disconnectHubSpot,
// };


//! Try -  1

import status from "http-status";
import axios from "axios";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import config from "../../config";


interface HubSpotOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}


// Generate HubSpot OAuth URL
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

    // Use config for scopes (ensure config.hubspot_scopes includes 'crm.objects.contacts.read crm.objects.contacts.write crm.schemas.custom.read crm.schemas.custom.write crm.objects.custom.read crm.objects.custom.write')
    const scopes = encodeURIComponent(config.hubspot_scopes as string);
    const authUrl = `https://app-na2.hubspot.com/oauth/authorize?client_id=a39e0394-1a64-416d-956c-de2f77678db0&redirect_uri=http://localhost:5000/api/v1/tools/hubspot/callback&scope=oauth&optional_scope=crm.schemas.custom.read%20crm.objects.custom.read%20crm.objects.custom.write`;

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

// Refresh HubSpot access token
const refreshHubSpotToken = async (orgId: string): Promise<string> => {
  try {
    const credential = await prisma.hubspotCredential.findUnique({
      where: { org_id: orgId },
    });

    if (!credential) {
      throw new AppError(status.NOT_FOUND, "HubSpot credentials not found");
    }

    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.hubspot_client_id,
        client_secret: config.hubspot_client_secret,
        refresh_token: credential.refreshToken,
      } as any),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await prisma.hubspotCredential.update({
      where: { org_id: orgId },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || credential.refreshToken, // Use new if provided
        expiresAt,
      },
    });

    return access_token;
  } catch (error: any) {
    console.error("Error refreshing HubSpot token:", error);
    throw new AppError(
      status.UNAUTHORIZED,
      `Failed to refresh HubSpot token: ${error.message}`
    );
  }
};

// Setup custom "qa_pair" object in HubSpot if it doesn't exist
const setupCustomQaPairObject = async (accessToken: string) => {
  try {
    // Check if schema exists
    const schemasResponse = await axios.get("https://api.hubapi.com/crm/v3/schemas", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const existingSchema = schemasResponse.data.results.find(
      (schema: any) => schema.name === "qa_pair"
    );

    if (existingSchema) {
      console.log("Custom object 'qa_pair' already exists with ID:", existingSchema.id);
      return;
    }

    // Create schema
    const schemaBody = {
      name: "qa_pair",
      labels: {
        singular: "QA Pair",
        plural: "QA Pairs",
      },
      requiredProperties: ["conv_id", "question", "answer"],
      searchableProperties: ["conv_id"],
      primaryDisplayProperty: "conv_id",
      secondaryDisplayProperties: ["question"],
      associatedObjects: ["CONTACT"], // Optional: Link to contacts
      properties: [
        {
          name: "conv_id",
          label: "Conversation ID",
          type: "string",
          fieldType: "text",
          groupName: "qapair_information",
        },
        {
          name: "question",
          label: "Question",
          type: "string",
          fieldType: "textarea",
          groupName: "qapair_information",
        },
        {
          name: "answer",
          label: "Answer",
          type: "string",
          fieldType: "textarea",
          groupName: "qapair_information",
        },
        {
          name: "created_at",
          label: "Created At",
          type: "datetime",
          fieldType: "date",
          groupName: "qapair_information",
        },
      ],
    };

    const response = await axios.post("https://api.hubapi.com/crm/v3/schemas", schemaBody, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("Custom object 'qa_pair' created successfully:", response.data);
  } catch (error: any) {
    console.error("Error in setupCustomQaPairObject:", error.response?.data || error.message);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to check/create custom object: ${error.response?.data?.message || error.message}`
    );
  }
};

// Handle HubSpot OAuth callback (updated to use HubspotCredential model)
// const handleHubSpotCallback = async (code: string, state: string) => {
//   const orgId = state;
//   if (!orgId) {
//     throw new AppError(status.BAD_REQUEST, "Missing organization ID");
//   }

//   try {
//     const tokenResponse = await axios.post(
//       "https://api.hubapi.com/oauth/v1/token",
//       new URLSearchParams({
//         grant_type: "authorization_code",
//         client_id: config.hubspot_client_id,
//         client_secret: config.hubspot_client_secret,
//         redirect_uri: config.hubspot_redirect_uri,
//         code,
//       } as any),
//       { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//     );

//     const { access_token, refresh_token, expires_in } = tokenResponse.data;
//     const expiresAt = new Date(Date.now() + expires_in * 1000);

//     // Upsert credentials
//     await prisma.hubspotCredential.upsert({
//       where: { org_id: orgId },
//       update: {
//         accessToken: access_token,
//         refreshToken,
//         expiresAt,
//         lastSyncedAt: null, // Reset for initial sync
//       },
//       create: {
//         org_id: orgId,
//         accessToken: access_token,
//         refreshToken,
//         expiresAt,
//         lastSyncedAt: null,
//       },
//     });

//     // Setup custom object
//     await setupCustomQaPairObject(access_token);

//     // Optional: Initial sync
//     const syncResult = await addQaPairsToHubSpot(orgId);
//     console.log(`Initial HubSpot sync: ${syncResult.message}`);

//     return {
//       message: "HubSpot connected and initial data synced successfully!",
//     };
//   } catch (error: any) {
//     console.error("Error in HubSpot callback:", error);
//     throw new AppError(
//       status.INTERNAL_SERVER_ERROR,
//       `Failed to connect HubSpot: ${error.message}`
//     );
//   }
// };

const handleHubSpotCallback = async (code: string, state: string) => {
  const orgId = state;
  if (!orgId) {
    throw new AppError(status.BAD_REQUEST, "Missing organization ID");
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.hubspot_client_id,
        client_secret: config.hubspot_client_secret,
        redirect_uri: config.hubspot_redirect_uri,
        code,
      } as any),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Upsert credentials
    await prisma.hubspotCredential.upsert({
      where: { org_id: orgId },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token, // Fixed: Use refresh_token instead of refreshToken
        expiresAt,
        lastSyncedAt: null, // Reset for initial sync
      },
      create: {
        org_id: orgId,
        accessToken: access_token,
        refreshToken: refresh_token, // Fixed: Use refresh_token instead of refreshToken
        expiresAt,
        lastSyncedAt: null,
      },
    });

    // Setup custom object
    await setupCustomQaPairObject(access_token);

    // Optional: Initial sync
    const syncResult = await addQaPairsToHubSpot(orgId);
    console.log(`Initial HubSpot sync: ${syncResult.message}`);

    return {
      message: "HubSpot connected and initial data synced successfully!",
    };
  } catch (error: any) {
    console.error("Error in HubSpot callback:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to connect HubSpot: ${error.message}`
    );
  }
};

// Sync QaPairs to HubSpot (mirrors Google Sheets sync)
// hubspot.service.ts
const addQaPairsToHubSpot = async (orgId: string) => {
  try {
    const credential = await prisma.hubspotCredential.findUnique({
      where: { org_id: orgId },
    });

    if (!credential) {
      throw new AppError(status.BAD_REQUEST, "HubSpot not connected for this organization");
    }

    let accessToken = credential.accessToken;
    if (credential.expiresAt < new Date()) {
      accessToken = await refreshHubSpotToken(orgId);
    }

    // Get the objectTypeId for qa_pair
    const schemasResponse = await axios.get("https://api.hubapi.com/crm/v3/schemas", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const qaPairSchema = schemasResponse.data.results.find(
      (schema: any) => schema.name === "qa_pair"
    );

    if (!qaPairSchema) {
      throw new AppError(status.NOT_FOUND, "Custom object 'qa_pair' not found in HubSpot");
    }

    const objectTypeId = qaPairSchema.objectTypeId;

    const qaPairs = await prisma.qaPair.findMany({
      where: {
        org_id: orgId,
        createdAt: {
          gt: credential.lastSyncedAt || undefined,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (qaPairs.length === 0) {
      return {
        message: "No new Q&A pairs to sync to HubSpot",
      };
    }

    // Validate QaPairs
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

    // Sync each QaPair as a custom object instance
    for (const qaPair of qaPairs) {
      const body = {
        properties: {
          conv_id: qaPair.conv_id,
          question: qaPair.question,
          answer: qaPair.answer,
          created_at: qaPair.createdAt.toISOString(),
        },
      };

      await axios.post(`https://api.hubapi.com/crm/v3/objects/${objectTypeId}`, body, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    // Update last synced time
    await prisma.hubspotCredential.update({
      where: { org_id: orgId },
      data: { lastSyncedAt: new Date() },
    });

    console.log(`Successfully synced ${qaPairs.length} Q&A pairs to HubSpot for organization ${orgId}`);

    return {
      message: `Successfully synced ${qaPairs.length} Q&A pairs to HubSpot`,
    };
  } catch (error: any) {
    console.error("Error syncing Q&A pairs to HubSpot:", error.response?.data || error.message);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to sync Q&A pairs to HubSpot: ${error.response?.data?.message || error.message}`
    );
  }
};

// Get HubSpot connection status
const getHubSpotStatus = async (orgId: string, user: any) => {
  try {
    const credential = await prisma.hubspotCredential.findUnique({
      where: { org_id: orgId },
    });

    if (!["organization_admin", "super_admin"].includes(user.role)) {
      throw new AppError(
        status.FORBIDDEN,
        "You are not authorized to view HubSpot status for this organization"
      );
    }

    const isConnected = !!credential;
    let portalId = null;
    let accountName = null;

    if (isConnected) {
      let accessToken = credential.accessToken;
      if (credential.expiresAt < new Date()) {
        accessToken = await refreshHubSpotToken(orgId);
      }

      const portalInfo = await axios.get("https://api.hubapi.com/integrations/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      portalId = portalInfo.data.portalId;
      accountName = portalInfo.data.accountName || "HubSpot Account";
    }

    return {
      isConnected,
      portalId,
      accountName,
      lastSyncedAt: credential?.lastSyncedAt || null,
    };
  } catch (error: any) {
    console.error("Error getting HubSpot status:", error.response?.data || error.message);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to get HubSpot status: ${error.response?.data?.message || error.message}`
    );
  }
};

// Disconnect HubSpot
const disconnectHubSpot = async (orgId: string, user: any) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
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

    await prisma.hubspotCredential.delete({
      where: { org_id: orgId },
    });

    return { message: "HubSpot disconnected successfully" };
  } catch (error: any) {
    console.error("Error disconnecting HubSpot:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to disconnect HubSpot: ${error.message}`
    );
  }
};

export const HubSpotService = {
  getHubSpotConnectUrl,
  handleHubSpotCallback,
  addQaPairsToHubSpot,
  getHubSpotStatus,
  disconnectHubSpot,
};