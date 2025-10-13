import status from "http-status";
import { Twilio } from "twilio";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { User } from "@prisma/client";
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

// Optional: Add specific filters for common phone number queries
// const getAllTwilioPhoneNumbersFromDB = async (
//   query: Record<string, unknown>,
//    filters: any = {},
// ) => {

//    let searchTerm = filters?.searchTerm as string;


//   // // Build where clause for Call model
//   // let whereClause: any = {
//   //   agentId: user?.id,
//   // };

//   // // If search term exists, ADD search conditions to the existing whereClause
//   // if (searchTerm) {
//   //   whereClause.AND = [
//   //     {
//   //       OR: [
//   //         { from_number: { contains: searchTerm, mode: "insensitive" } },
//   //         { to_number: { contains: searchTerm, mode: "insensitive" } },
//   //         { call_status: { contains: searchTerm, mode: "insensitive" } },
//   //         { callType: { contains: searchTerm, mode: "insensitive" } },
//   //         // {
//   //         //   Agent: {
//   //         //     employeeId: { contains: searchTerm, mode: "insensitive" },
//   //         //   },
//   //         // },
//   //       ],
//   //     },
//   //   ];
//   // }
//   const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

//   const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];

//   const customFilters: Record<string, any> = {};


//   if (query.isPurchased !== undefined) {
//     if (query.isPurchased === "true" || query.isPurchased === true) {
//       // console.log("here true")
//       customFilters.isPurchased = true;
//     } else if (query.isPurchased === "false" || query.isPurchased === false) {
//       // console.log("here false")
//       customFilters.isPurchased = false;
//     }
//   }

//   if (query.phoneNumberPattern) {
//     customFilters.phoneNumber = {
//       contains: query.phoneNumberPattern as string,
//     };
//   }

//   if (query.capability) {
//     const capabilities = Array.isArray(query.capability)
//       ? query.capability
//       : [query.capability];
//     customFilters.capabilities = { hasSome: capabilities };
//   }

//   const result = await queryBuilder
//     .search(searchableFields)
//     .filter()
//     .rawFilter(customFilters)
//     .include({
//       organization: true,
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

// get my own purchased numbers
const getMyOwnPurchasedNumbersFromDB = async (
  query: Record<string, unknown>,
  user: User
) => {
  let searchTerm = query?.searchTerm as string;
  const orgAdmin = await prisma.user.findFirst({
    where: {
      id: user?.id,
    },
    select: {
      ownedOrganization: {
        select: {
          id: true,
        },
      },
    }
  })


  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);

  const searchableFields = ["phoneNumber", "friendlyName", "countryCode"];


  const customFilters: Record<string, any> = {
    purchasedByOrganizationId: orgAdmin?.ownedOrganization?.id
  }


  if (query.phoneNumberPattern) {
    customFilters.phoneNumber = {
      contains: query.phoneNumberPattern as string,
    };
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
      organization: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          organizationNumber: true,
          industry: true,
          address: true,
          websiteLink: true
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
  fetchAndStoreAvailableNumbers,
  getAllTwilioPhoneNumbersFromDB,
  getMyOwnPurchasedNumbersFromDB,
  getSingleTwilioPhoneNumberFromDB,
  updateTwilioPhoneNumberIntoDB,
  deleteTwilioPhoneNumberFromDB,
};
