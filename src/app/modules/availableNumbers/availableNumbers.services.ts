import status from "http-status";
import { Twilio } from "twilio";
import config from "../../config";
import AppError from "../../errors/AppError";
import prisma from "../../utils/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { User } from "@prisma/client";
// Initialize Twilio client
const twilioClient = new Twilio(
  config.twilio.account_sid || "AC3c7b7f9af62077ff16931a102df853ff",
  config.twilio.auth_token || "a41bc468563b887df58bd3ecc4851c94"
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
          isPurchased: true, // Mark as purchased
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
          isPurchased: false
        },
      });
    }
  } catch (error:any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to fetch and store existing phone numbers: ${error.message}`
    );
  }
};

// Optional: Add specific filters for common phone number queries
const getAllTwilioPhoneNumbersFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(prisma.availableTwilioNumber, query);
  
  const searchableFields = ['phoneNumber', 'friendlyName', 'countryCode'];
  
  const customFilters: Record<string, any> = {
    isPurchased: Boolean(query?.isPurchased)
  };
  
  if (query.phoneNumberPattern) {
    customFilters.phoneNumber = { contains: query.phoneNumberPattern as string };
  }
  
  if (query.capability) {
    const capabilities = Array.isArray(query.capability) 
      ? query.capability 
      : [query.capability];
    customFilters.capabilities = { hasSome: capabilities };
  }
  
  const result = await queryBuilder
    .search(searchableFields)
    .filter()
    .rawFilter(customFilters)
    .include({
      organization: true
    })
    .sort()
    .paginate()
    .fields()
    .execute();
  
  const meta = await queryBuilder.countTotal();
  
  return {
    meta,
    data: result
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
  } catch (error:any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to update phone number: ${error.message}`
    );
  }
};

const deleteTwilioPhoneNumberFromDB = async (sid: string): Promise<void> => {
  try {
    await twilioClient.incomingPhoneNumbers(sid).remove();
  } catch (error:any) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to delete phone number: ${error.message}`
    );
  }
};

export const TwilioPhoneNumberService = {
  fetchAndStoreAvailableNumbers,
  getAllTwilioPhoneNumbersFromDB,
  getSingleTwilioPhoneNumberFromDB,
  updateTwilioPhoneNumberIntoDB,
  deleteTwilioPhoneNumberFromDB,
};
