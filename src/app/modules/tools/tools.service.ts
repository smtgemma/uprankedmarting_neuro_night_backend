import status from "http-status";
import axios from "axios";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";


interface CreateLeadPayload {
  organizationId: string;
}

const createHubSpotLead = async (payload: CreateLeadPayload) => {
  const { organizationId } = payload;

  // 1. Fetch organization and subscription data
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
    //   organizationEmail: true,
      subscriptions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { purchasedNumber: true },
      },
    },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found");
  }

  const subscription = organization.subscriptions[0];
  if (!subscription || !subscription.purchasedNumber) {
    throw new AppError(status.NOT_FOUND, "No active subscription with phone number found");
  }

  // 2. Prepare HubSpot payload
  const [firstName, ...lastNameParts] = organization.name.split(" ");
  const lastName = lastNameParts.join(" ") || "Unknown"; // Fallback if no last name
  const hubspotPayload = {
    properties: {
      firstname: firstName || "Unknown",
      lastname: lastName,
    //   email: organization.organizationEmail,
      phone: subscription.purchasedNumber,
    },
  };

  // 3. Send POST request to HubSpot
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;
  if (!hubspotApiKey) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, "HubSpot API key not configured");
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
      organizationId,
    //   email: organization.organizationEmail,
    };
  } catch (error) {
    console.error("Error creating HubSpot lead:", error);
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create HubSpot lead");
  }
};

export const ToolsService = {
  createHubSpotLead,
};