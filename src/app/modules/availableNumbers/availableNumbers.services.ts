import status from "http-status";
import { Twilio } from "twilio";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { PhoneNumberRequestStatus, SubscriptionStatus } from "@prisma/client";
import { sendPhoneNumberRequestEmail } from "../../utils/sendPhoneNumberRequestEmail";
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
          requestedByOrgId: null,
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

const getSingleTwilioPhoneNumberFromDB = async (id: string) => {
  const number = await prisma.availableTwilioNumber.findUnique({
    where: {
      id,
    },
  });

  return number;
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

// ============ SUPER ADMIN SERVICES ============

const getAllNumbersForAdmin = async (query: Record<string, unknown>) => {
  const searchTerm = query?.searchTerm as string;
  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

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
  // Filter by country code
  if (query.countryCode) {
    customFilters.countryCode = query.countryCode as string;
  }


  if (searchTerm) {
    customFilters.OR = [
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
      requestedByOrg: {
        //  CHANGED: organization -> requestedByOrg
        select: {
          id: true,
          name: true,
          ownedOrganization: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
      purchasedByOrg: {
        //  ADDED: Include purchased org too
        select: {
          id: true,
          name: true,
          ownedOrganization: {
            select: {
              email: true,
              phone: true,
            },
          },
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
const getAllPhoneNumberRequests = async (query: Record<string, unknown>) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    searchTerm,
    status,
    organizationId
  } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (searchTerm) {
    where.OR = [
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
      {
        requesterName: { contains: searchTerm, mode: "insensitive" },
      }
    ];
  }

  
  // Get phone number requests with organization details
  const [requests, total] = await Promise.all([
    prisma.phoneNumberRequest.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            industry: true,
            address: true,
            websiteLink: true,
            requestedTwilioNumbers: {
              select:{
                phoneNumber: true
              }
            },
            ownedOrganization: {
              select: {
                id: true,
                phone: true,
                name: true,
                email: true,
              },

            }
          }
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip,
      take,
    }),
    prisma.phoneNumberRequest.count({ where })
  ]);

  const totalPage = Math.ceil(total / take);

  return {
    meta: {
      page: Number(page),
      limit: take,
      total,
      totalPage
    },
    data: requests,
  };
};
// const getAllPhoneNumberRequests = async (query: Record<string, unknown>) => {
//   const searchTerm = query?.searchTerm as string;
//   const queryBuilder = new QueryBuilder(prisma.phoneNumberRequest, query);

//   const customFilters: Record<string, any> = {};

//   // Filter by status
//   if (query.status) {
//     customFilters.status = query.status as PhoneNumberRequestStatus;
//   }

//   // Filter by organization
//   if (query.organizationId) {
//     customFilters.organizationId = query.organizationId as string;
//   }

//   if (searchTerm) {
//     customFilters.OR = [
//       {
//         organization: {
//           name: { contains: searchTerm, mode: "insensitive" },
//         },
//       },
//       {
//         organization: {
//           ownedOrganization: {
//             email: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//       {
//         organization: {
//           ownedOrganization: {
//             phone: { contains: searchTerm, mode: "insensitive" },
//           },
//         },
//       },
//       {
//         requesterName: { contains: searchTerm, mode: "insensitive" },
//       }
//     ];
//   }

//   const result = await queryBuilder
//     .filter()
//     .rawFilter(customFilters)
//     .include({
//       organization: {
//         select: {
//           id: true,
//           name: true,
//           ownedOrganization: {
//             select: {
//               id: true,
//               phone: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       },

//     })
//     .sort()
//     .paginate()
//     .fields()
//     .execute();

//   const meta = await queryBuilder.countTotal();

//   return {
//     meta,
//     data: result,
//   };
// };

// const togglePinNumber = async (
//   numberId: string,
//   payload: {
//     isPinned: boolean;
//     organizationId?: string;
//   }
// ) => {
//   const number = await prisma.availableTwilioNumber.findUnique({
//     where: { id: numberId },
//   });

//   if (!number) {
//     throw new AppError(status.NOT_FOUND, "Phone number not found!");
//   }

//   // If pinning, ensure organizationId is provided
//   if (payload.isPinned && !payload.organizationId) {
//     throw new AppError(status.BAD_REQUEST, "Organization ID is required when pinning a number!");
//   }

//   const result = await prisma.availableTwilioNumber.update({
//     where: { id: numberId },
//     data: {
//       isPinned: payload.isPinned,
//       requestedByOrgId: payload.isPinned ? payload.organizationId : null,
//     },
//     include: {
//       organization: true,
//     },
//   });

//   return result;
// };

// 2. UPDATE: togglePinNumber
// ==========================================
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

  // Prevent pinning purchased numbers
  if (number.isPurchased) {
    throw new AppError(status.BAD_REQUEST, "Cannot pin a purchased number!");
  }

  // Ensure orgId is provided when pinning
  if (payload.isPinned && !payload.organizationId) {
    throw new AppError(
      status.BAD_REQUEST,
      "Organization ID is required when pinning a number!"
    );
  }

  //  Prevent multiple pinned numbers for same org
  if (payload.isPinned && payload.organizationId) {
    const alreadyPinned = await prisma.availableTwilioNumber.findFirst({
      where: {
        requestedByOrgId: payload.organizationId,
        isPinned: true,
        id: { not: numberId }, // exclude the current one
      },
    });

    if (alreadyPinned) {
      throw new AppError(
        status.BAD_REQUEST,
        "This organization already has a pinned number!"
      );
    }
  }

  // Update number pin status
  const result = await prisma.availableTwilioNumber.update({
    where: { id: numberId },
    data: {
      isPinned: payload.isPinned,
      requestedByOrgId: payload.isPinned ? payload.organizationId : null,
    },
    include: {
      requestedByOrg: true,
      purchasedByOrg: true,
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
        // purchasedByOrganizationId: request.organizationId,
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

// ==========================================
// 4. UPDATE: getAvailableNumbersForOrg
// ==========================================
const getAvailableNumbersForOrg = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // 1️⃣ Find organization by userId
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  const searchTerm = query?.searchTerm as string;
  const take = Number(query.limit) || 10;
  const skip = Number(query.skip) || 0;

  const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];

  // 2️⃣ Build Prisma `where` condition
  const where: any = {
    OR: [
      // Unpinned and unpurchased numbers (available for all)
      { isPinned: false, isPurchased: false },
      // Numbers pinned/requested by THIS organization
      { isPinned: true, requestedByOrgId: organization.id },
    ],
  };

  // Filter by pattern
  if (query.phoneNumberPattern) {
    where.phoneNumber = {
      contains: query.phoneNumberPattern as string,
      mode: "insensitive",
    };
  }

  // Filter by country code
  if (query.countryCode) {
    where.countryCode = query.countryCode as string;
  }

  // Search by text
  if (searchTerm) {
    where.AND = {
      OR: searchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    };
  }

  // 3️⃣ Fetch data with correct includes
  const data = await prisma.availableTwilioNumber.findMany({
    where,
    orderBy: [
      { isPinned: "desc" }, // Pinned numbers first
      { createdAt: "desc" }, // Newest after pinned
    ],
    skip,
    take,
    include: {
      requestedByOrg: {
        select: {
          id: true,
          name: true,
          industry: true,
          address: true,
          websiteLink: true,
          organizationNumber: true,
          ownerId: true,
        },
      }, // Organization that requested/pinned
      purchasedByOrg: {
        select: {
          id: true,
          name: true,
          industry: true,
          address: true,
          websiteLink: true,
          organizationNumber: true,
          ownerId: true,
        },
      }, // Organization that purchased (if any)
    },
  });

  // 4️⃣ Count total
  const total = await prisma.availableTwilioNumber.count({ where });

  return {
    meta: {
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    },
    data,
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
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId },
    include: {
      ownedOrganization: true,
      requestedPhoneNumber: true, // Include existing phone number request
      subscriptions: {
        where: {
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.TRIALING,
              SubscriptionStatus.INCOMPLETE
            ]
          }
        }
      }
    },
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found!");
  }

  // ✅ CHECK: Organization should NOT have any active subscription
  if (organization.subscriptions.length > 0) {
    const activeSub = organization.subscriptions[0];
    throw new AppError(
      status.BAD_REQUEST,
      `You already have an active ${activeSub.planLevel} subscription. Please use your subscribed features instead of requesting a phone number.`
    );
  }

  // ✅ CHECK: Organization should NOT have a purchased phone number
  if (organization.purchasedPhoneNumber) {
    throw new AppError(
      status.BAD_REQUEST,
      "Organization already has a purchased phone number!"
    );
  }

  // Check for existing pending request
  const existingPendingRequest = await prisma.phoneNumberRequest.findFirst({
    where: {
      organizationId: organization.id,
      status: PhoneNumberRequestStatus.PENDING,
    },
  });

  // OPTION 1: Update existing pending request instead of creating new one
  if (existingPendingRequest) {
    const updatedRequest = await prisma.phoneNumberRequest.update({
      where: { id: existingPendingRequest.id },
      data: {
        requesterName: payload.requesterName,
        message: payload.message,
        requestedPhonePattern: payload.requestedPhonePattern,
        updatedAt: new Date(),
      },
      include: {
        organization: {
          include: {
            ownedOrganization: {
              select: {
                email: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Send email notification for updated request
    try {
      await sendPhoneNumberRequestEmail(
        {
          requesterName: payload.requesterName,
          message: payload.message
            ? `(Updated Request) ${payload.message}`
            : "Request details updated",
          requestedPhonePattern: payload.requestedPhonePattern,
        },
        organization.ownedOrganization?.email || "noreply@answersmart.com"
      );
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }

    return {
      ...updatedRequest,
      message: "Existing phone number request updated successfully!",
      isUpdated: true,
    };
  }

  // Check for recent rejected requests (within last 7 days)
  const recentRejectedRequest = await prisma.phoneNumberRequest.findFirst({
    where: {
      organizationId: organization.id,
      status: PhoneNumberRequestStatus.REJECTED,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    },
  });

  if (recentRejectedRequest) {
    throw new AppError(
      status.BAD_REQUEST,
      `Your previous request was rejected. You can submit a new request after ${new Date(
        recentRejectedRequest.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
      ).toLocaleDateString()}.`
    );
  }

  // Create new request
  const result = await prisma.phoneNumberRequest.create({
    data: {
      organizationId: organization.id,
      requesterName: payload.requesterName,
      message: payload.message,
      requestedPhonePattern: payload.requestedPhonePattern,
      status: PhoneNumberRequestStatus.PENDING,
    },
    include: {
      organization: {
        include: {
          ownedOrganization: {
            select: {
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      },
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
      organization.ownedOrganization?.email || "noreply@answersmart.com"
    );
  } catch (error) {
    console.error("Failed to send email notification:", error);
  }

  return {
    ...result,
    message: "Phone number request submitted successfully!",
    isUpdated: false,
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

  fetchAndStoreAvailableNumbers,
  getAllTwilioPhoneNumbersFromDB,
  getSingleTwilioPhoneNumberFromDB,
};
