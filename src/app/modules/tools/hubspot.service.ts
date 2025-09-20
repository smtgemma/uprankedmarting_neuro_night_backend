import status from "http-status";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import config from "../../config";
import axios from "axios";


interface HubSpotOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Generate HubSpot OAuth URL
const getHubSpotConnectUrl = async (orgId: string, user: any) => {
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

  const scopes = encodeURIComponent(config.hubspot_scopes as string); // যেমন: "crm.objects.contacts.write crm.objects.contacts.read"
  const authUrl = `https://app-na2.hubspot.com/oauth/authorize?client_id=a39e0394-1a64-416d-956c-de2f77678db0&redirect_uri=http://localhost:5000/api/v1/tools/hubspot/callback&scope=oauth&optional_scope=crm.schemas.custom.read%20crm.objects.custom.read%20crm.objects.custom.write`;
  // const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${config.hubspot_client_id}&redirect_uri=${encodeURIComponent(
  //   config.hubspot_redirect_uri as string
  // )}&scope=${scopes}&state=${orgId}`;

  return {
    authUrl,
    message: "Redirect user to this URL to connect HubSpot",
  };
};



// Handle HubSpot OAuth callback
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

    const credentials: HubSpotOAuthTokens = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    };

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        hubspotCredentials: credentials as any, // Json field in DB
      },
    });

    return {
      message: "HubSpot connected successfully!",
    };
  } catch (error: any) {
    console.error("Error exchanging HubSpot token:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to connect HubSpot: ${error.message}`
    );
  }
};




// Get HubSpot connection status
const getHubSpotStatus = async (orgId: string, user: any) => {
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      hubspotCredentials: true,
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

  const isConnected = !!organization.hubspotCredentials;

  return {
    isConnected,
  };
};

// Disconnect HubSpot
const disconnectHubSpot = async (orgId: string, user: any) => {
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

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      hubspotCredentials: null,
    },
  });

  return { message: "HubSpot disconnected successfully" };
};

export const HubSpotService = {
  getHubSpotConnectUrl,
  handleHubSpotCallback,
  getHubSpotStatus,
  disconnectHubSpot,
};
