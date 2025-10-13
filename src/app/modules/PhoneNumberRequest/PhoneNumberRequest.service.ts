// ============ 3. SERVICE LAYER ============
// phoneNumberRequest.services.ts

import { User } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import prisma from "../../utils/prisma";
import { sendPhoneNumberRequestEmail } from "../../utils/sendEmailForPhoneNumber";

const submitPhoneNumberRequestToDB = async (
  payload: {
    requesterName: string;
    requesterEmail: string;
    requesterPhone: string;
    message?: string;
    requestedPhonePattern?: string;
  },
  user: User
) => {
  const organization = await prisma.organization.findFirst({
    where: {
      ownerId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  // Check if organization already has a pending request
  const existingRequest = await prisma.phoneNumberRequest.findUnique({
    where: {
      organizationId: organization.id,
    },
  });

  if (existingRequest && existingRequest.status === "PENDING") {
    throw new Error("Organization already has a pending phone number request");
  }

  const request = await prisma.phoneNumberRequest.create({
    data: {
      organizationId: organization.id,
      requesterName: payload.requesterName,
      requesterEmail: payload.requesterEmail,
      requesterPhone: payload.requesterPhone,
      message: payload.message || null,
      requestedPhonePattern: payload.requestedPhonePattern || null,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await sendPhoneNumberRequestEmail(payload, user?.email);

  return request;
};

const getAllPhoneNumberRequestsFromDB = async (
  query: Record<string, unknown>
) => {
  const queryBuilder = new QueryBuilder(prisma.phoneNumberRequest, query);
  const searchableFields = ["requesterName", "requesterEmail", "requesterPhone"];

  const customFilters: Record<string, any> = {};

  if (query.searchTerm) {
    customFilters.OR = searchableFields.map((field) => ({
      [field]: { contains: query.searchTerm as string, mode: "insensitive" },
    }));
  }

  if (query.status) {
    customFilters.status = query.status;
  }

  if (query.organizationId) {
    customFilters.organizationId = query.organizationId;
  }

  const result = await queryBuilder
    .filter()
    .rawFilter(customFilters)
    .include({
      organization: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
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

const getSinglePhoneNumberRequestFromDB = async (id: string) => {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: {
      id,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          organizationNumber: true,
          address: true,
          websiteLink: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  return request;
};

const approvePhoneNumberRequestInDB = async (
  id: string,
  assignedNumberId: string
) => {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  // Check if phone number exists and is available
  const phoneNumber = await prisma.availableTwilioNumber.findUnique({
    where: { id: assignedNumberId },
  });

  if (!phoneNumber) {
    throw new Error("Phone number not found");
  }

  if (phoneNumber.isPurchased) {
    throw new Error("Phone number is already purchased");
  }

  // Check if any other request already has this number assigned
  const existingAssignment = await prisma.phoneNumberRequest.findFirst({
    where: {
      assignedNumberId,
      id: { not: id }, // Exclude current request
    },
  });

  if (existingAssignment) {
    throw new Error("Phone number is already assigned to another request");
  }

  // Update request with assigned number
  const updatedRequest = await prisma.phoneNumberRequest.update({
    where: { id },
    data: {
      status: "ASSIGNED",
      assignedNumberId,
      assignedAt: new Date(),
      approvedAt: new Date(),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedNumber: {
        select: {
          id: true,
          phoneNumber: true,
          friendlyName: true,
          countryCode: true,
        },
      },
    },
  });

  return updatedRequest;
};

const rejectPhoneNumberRequestInDB = async (
  id: string,
  rejectionReason: string
) => {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const updatedRequest = await prisma.phoneNumberRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason,
      rejectedAt: new Date(),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updatedRequest;
};

export const PhoneNumberRequestService = {
  submitPhoneNumberRequestToDB,
  getAllPhoneNumberRequestsFromDB,
  getSinglePhoneNumberRequestFromDB,
  approvePhoneNumberRequestInDB,
  rejectPhoneNumberRequestInDB,
};