import status from "http-status";
import { Twilio } from "twilio";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { PhoneNumberRequestStatus } from "@prisma/client";
import { sendPhoneNumberRequestEmail } from "../../utils/sendEmailForPhoneNumber";
// Initialize Twilio client
const twilioClient = new Twilio(
  config.twilio.account_sid,
  config.twilio.auth_token
);
// Fetch available numbers from Twilio and store in DB
const fetchAndStoreAvailableNumbers = async () => {
  try {
    // Fetch numbers you already own from Twilio
    const myNumbers = await twilioClient.incomingPhoneNumbers.list();
    // Store/update in database
    for (const number of myNumbers) {
      await prisma.availableTwilioNumber.upsert({
        where: { phoneNumber: number.phoneNumber },
        update: {
          sid: number.sid,
          friendlyName: number.friendlyName,
          purchasedAt: new Date(),
          capabilities: {
            voice: number.capabilities.voice,
            sms: number.capabilities.sms,
            mms: number.capabilities.mms,
            fax: number.capabilities.fax,
          },
          beta: number.beta || false,
        },
        create: {
          sid: number.sid,
          phoneNumber: number.phoneNumber,
          friendlyName: number.friendlyName,
          capabilities: {
            voice: number.capabilities.voice,
            sms: number.capabilities.sms,
            mms: number.capabilities.mms,
            fax: number.capabilities.fax,
          },
          beta: number.beta || false,
          countryCode: "US",
          isPurchased: false,
          isPinned: false,
          purchasedAt: null,
          purchasedByOrganizationId: null,
        },
      });
    }
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to fetch and store existing phone numbers: ${error.message}`
    );
  }
};

const getAllTwilioPhoneNumbersFromDB = async (
  query: Record<string, unknown>
) => {
  let searchTerm = query?.searchTerm as string;

  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

  const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];

  const customFilters: Record<string, any> = {};

  if (query.isPurchased !== undefined) {
    if (query.isPurchased === "true" || query?.isPurchased === true) {
      customFilters.isPurchased = true;
    } else if (query.isPurchased === "false" || query?.isPurchased === false) {
      customFilters.isPurchased = false;
    }
  }

  if (query.phoneNumberPattern) {
    customFilters.phoneNumber = {
      contains: query.phoneNumberPattern as string,
    };
  }

  if (query.capability) {
    const capabilities = Array.isArray(query.capability)
      ? query.capability
      : [query.capability];
    customFilters.capabilities = { hasSome: capabilities };
  }

  if (searchTerm) {
    customFilters.OR = searchableFields.map((field) => ({
      [field]: { contains: searchTerm, mode: "insensitive" },
    }));
  }

  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters) // 👈 merged here
    .include({
      organization: true,
    })
    .sort()
    .paginate()
    .fields()
    .execute();

  const meta = await queryBuilder.countTotal();

  return {
    meta,
    data: result,
  };
};




const getSingleTwilioPhoneNumberFromDB = async (id: string) => {
  const number = await prisma.availableTwilioNumber.findUnique({
    where: {
      id,
    },
  });

  return number;
};

const updateTwilioPhoneNumberIntoDB = async (sid: string, payload: any) => {
  try {
    const updateData: any = {};

    if (payload.friendlyName) updateData.friendlyName = payload.friendlyName;
    if (payload.voiceUrl !== undefined) updateData.voiceUrl = payload.voiceUrl;
    if (payload.smsUrl !== undefined) updateData.smsUrl = payload.smsUrl;
    if (payload.status) updateData.status = payload.status;

    const updatedNumber = await twilioClient
      .incomingPhoneNumbers(sid)
      .update(updateData);

    return {
      sid: updatedNumber.sid,
      accountSid: updatedNumber.accountSid,
      phoneNumber: updatedNumber.phoneNumber,
      friendlyName: updatedNumber.friendlyName,
      voiceUrl: updatedNumber.voiceUrl,
      smsUrl: updatedNumber.smsUrl,
      status: updatedNumber.status,
      capabilities: {
        voice: updatedNumber.capabilities.voice,
        sms: updatedNumber.capabilities.sms,
        mms: updatedNumber.capabilities.mms,
        fax: updatedNumber.capabilities.fax,
      },
      origin: updatedNumber.origin,
    };
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to update phone number: ${error.message}`
    );
  }
};

const deleteTwilioPhoneNumberFromDB = async (sid: string): Promise<void> => {
  try {
    await twilioClient.incomingPhoneNumbers(sid).remove();
  } catch (error: any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to delete phone number: ${error.message}`
    );
  }
};



// ============ SUPER ADMIN SERVICES ============

const getAllNumbersForAdmin = async (query: Record<string, unknown>) => {
  const searchTerm = query?.searchTerm as string;
  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

  const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];
  const customFilters: Record<string, any> = {};

  // Filter by purchased status
  if (query.isPurchased !== undefined) {
    if (query.isPurchased === "true" || query?.isPurchased === true) {
      customFilters.isPurchased = true;
    } else if (query.isPurchased === "false" || query?.isPurchased === false) {
      customFilters.isPurchased = false;
    }
  }

  // Filter by pinned status
  if (query.isPinned !== undefined) {
    if (query.isPinned === "true" || query?.isPinned === true) {
      customFilters.isPinned = true;
    } else if (query.isPinned === "false" || query?.isPinned === false) {
      customFilters.isPinned = false;
    }
  }

  // Filter by phone number pattern
  // if (query.phoneNumberPattern) {
  //   customFilters.phoneNumber = {
  //     contains: query.phoneNumberPattern as string,
  //   };
  // }

  // Filter by country code
  if (query.countryCode) {
    customFilters.countryCode = query.countryCode as string;
  }

  // Search functionality
  if (searchTerm) {
    customFilters.OR = searchableFields.map((field) => ({
      [field]: { contains: searchTerm, mode: "insensitive" },
    }));
  }

  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters)
    .include({
      organization: {
        select: {
          id: true,
          name: true,
          ownedOrganization: {
            select: {
              email: true,
              phone: true,
            }
          }
        }
      }
    })
    .sort()
    .paginate()
    .fields()
    .execute();

  const meta = await queryBuilder.countTotal();

  return {
    meta,
    data: result,
  };
};

const getAllPhoneNumberRequests = async (query: Record<string, unknown>) => {
  const searchTerm = query?.searchTerm as string;
  const queryBuilder = new QueryBuilder(prisma.phoneNumberRequest, query);


  const customFilters: Record<string, any> = {};

  // Filter by status
  if (query.status) {
    customFilters.status = query.status as PhoneNumberRequestStatus;
  }

  // Filter by organization
  if (query.organizationId) {
    customFilters.organizationId = query.organizationId as string;
  }

  if (searchTerm) {
    customFilters.OR = [
      { requesterName: { contains: searchTerm, mode: "insensitive" } },
      {
        organization: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
      {
        organization: {
          ownedOrganization: {
            email: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
      {
        organization: {
          ownedOrganization: {
            phone: { contains: searchTerm, mode: "insensitive" },
          },
        },
      },
    ];
  }


  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters)
    .include({
      organization: {
        select: {
          id: true,
          name: true,
          ownedOrganization: {
            select: {
              id: true,
              phone: true,
              name: true,
              email: true,
            }
          },
        },
      },
      // assignedNumber: {
      //   select: {
      //     id: true,
      //     phoneNumber: true,
      //     friendlyName: true,
      //   },
      // },
    })
    .sort()
    .paginate()
    .fields()
    .execute();

  const meta = await queryBuilder.countTotal();

  return {
    meta,
    data: result,
  };
};

const togglePinNumber = async (
  numberId: string,
  payload: {
    isPinned: boolean;
    organizationId?: string;
  }
) => {
  const number = await prisma.availableTwilioNumber.findUnique({
    where: { id: numberId },
  });

  if (!number) {
    throw new AppError(status.NOT_FOUND, "Phone number not found!");
  }

  const result = await prisma.availableTwilioNumber.update({
    where: { id: numberId },
    data: {
      isPinned: payload.isPinned,
      purchasedByOrganizationId: payload.isPinned
        ? payload.organizationId
        : null,
    },
    include: {
      organization: true,
    },
  });

  return result;
};


const updateRequestStatus = async (
  requestId: string,
  payload: {
    status: PhoneNumberRequestStatus;
    assignedNumberId?: string;
    rejectionReason?: string;
  }
) => {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError(status.NOT_FOUND, "Phone number request not found!");
  }

  const updateData: any = {
    status: payload.status,
  };

  if (payload.status === PhoneNumberRequestStatus.APPROVED) {
    updateData.approvedAt = new Date();
  } else if (payload.status === PhoneNumberRequestStatus.REJECTED) {
    updateData.rejectedAt = new Date();
    updateData.rejectionReason = payload.rejectionReason;
  } else if (payload.status === PhoneNumberRequestStatus.ASSIGNED) {
    if (!payload.assignedNumberId) {
      throw new AppError(
        status.BAD_REQUEST,
        "Assigned number ID is required for assignment!"
      );
    }
    updateData.assignedAt = new Date();
    updateData.assignedNumberId = payload.assignedNumberId;

    // Update the phone number as purchased
    await prisma.availableTwilioNumber.update({
      where: { id: payload.assignedNumberId },
      data: {
        isPurchased: true,
        purchasedAt: new Date(),
        purchasedByOrganizationId: request.organizationId,
      },
    });
  }

  const result = await prisma.phoneNumberRequest.update({
    where: { id: requestId },
    data: updateData,
    include: {
      organization: true,
    },
  });

  return result;
};


// ============ ORGANIZATION ADMIN SERVICES ============

const getAvailableNumbersForOrg = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // Get organization by userId
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  const searchTerm = query?.searchTerm as string;
  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

  const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];
  const customFilters: Record<string, any> = {
    OR: [
      // All unpinned and unpurchased numbers
      {
        isPinned: false,
        isPurchased: false,
      },
      // Numbers pinned for this organization
      {
        isPinned: true,
        purchasedByOrganizationId: organization.id,
      },
    ],
  };

  // Filter by phone number pattern
  if (query.phoneNumberPattern) {
    customFilters.phoneNumber = {
      contains: query.phoneNumberPattern as string,
    };
  }

  // Filter by country code
  if (query.countryCode) {
    customFilters.countryCode = query.countryCode as string;
  }

  // Search functionality
  if (searchTerm) {
    customFilters.AND = {
      OR: searchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    };
  }

  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters)
    .sort()
    .paginate()
    .fields()
    .execute();

  const meta = await queryBuilder.countTotal();

  return {
    meta,
    data: result,
  };
};

const requestPhoneNumber = async (
  userId: string,
  payload: {
    requesterName: string;
    message?: string;
    requestedPhonePattern?: string;
  }
) => {
  // Get organization by userId
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId },
    include: {
      ownedOrganization: true,
    },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  // Check if organization already has a pending request
  const existingRequest = await prisma.phoneNumberRequest.findFirst({
    where: {
      organizationId: organization.id,
      status: PhoneNumberRequestStatus.PENDING,
    },
  });

  if (existingRequest) {
    throw new AppError(
      status.BAD_REQUEST,
      "You already have a pending phone number request!"
    );
  }

  // Create the request
  const result = await prisma.phoneNumberRequest.create({
    data: {
      organizationId: organization.id,
      requesterName: payload.requesterName,
      // requesterEmail: payload.requesterEmail,
      // requesterPhone: payload.requesterPhone as string,
      message: payload.message,
      requestedPhonePattern: payload.requestedPhonePattern,
      status: PhoneNumberRequestStatus.PENDING,
    },
    include: {
      organization: true,
    },
  });

  // Send email notification to admin
  try {
    await sendPhoneNumberRequestEmail(
      {
        requesterName: payload.requesterName,
        message: payload.message,
        requestedPhonePattern: payload.requestedPhonePattern,
      },
      organization?.ownedOrganization?.email || "noreply@answersmart.com"
    );
  } catch (error) {
    console.error("Failed to send email notification:", error);
    // Don't throw error, just log it
  }

  return result;
};

const getOrgPhoneNumberRequests = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // Get organization by userId
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  const queryBuilder = new QueryBuilder(prisma.phoneNumberRequest, query);

  const customFilters: Record<string, any> = {
    organizationId: organization.id,
  };

  // Filter by status
  if (query.status) {
    customFilters.status = query.status as PhoneNumberRequestStatus;
  }

  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters)
    .include({
      assignedNumber: {
        select: {
          id: true,
          phoneNumber: true,
          friendlyName: true,
          isPinned: true,
        },
      },
    })
    .sort()
    .paginate()
    .fields()
    .execute();

  const meta = await queryBuilder.countTotal();

  return {
    meta,
    data: result,
  };
};

export const TwilioPhoneNumberService = {
  // Super Admin
  getAllNumbersForAdmin,
  getAllPhoneNumberRequests,
  updateRequestStatus,
  togglePinNumber,

  // Organization Admin
  getAvailableNumbersForOrg,
  requestPhoneNumber,
  getOrgPhoneNumberRequests,

  fetchAndStoreAvailableNumbers,
  getAllTwilioPhoneNumbersFromDB,
  getSingleTwilioPhoneNumberFromDB,
  updateTwilioPhoneNumberIntoDB,
  deleteTwilioPhoneNumberFromDB,
};
