import status from "http-status";
// import QueryBuilder from "../../builder/QueryBuilder";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import {
  IPaginationOptions,
  paginationHelper,
} from "../../utils/paginationHelpers";
import { User } from "@prisma/client";

const getAllOrganizations = async () => {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      industry: true,
      organizationNumber: true,
      ownerId: true,
      subscriptions: {
        select: {
          id: true,
          amount: true,
          startDate: true,
          endDate: true,
          paymentStatus: true,
          planLevel: true,
          purchasedNumber: true,
          sid: true,
          numberOfAgents: true,
          status: true,
          plan: {
            select: {
              id: true,
              planName: true,
            },
          },
        },
      },
    },
  });

  return { data: organizations };
};

const getSingleOrganization = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    // include: {

    // }
  });

  if (!organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found");
  }

  return organization;
};

const getOrganizationCallLogsManagement = async (
  options: IPaginationOptions,
  filters: any = {},
  user: User
) => {
  let searchTerm = filters?.searchTerm as string;

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const getOrganizationAdmin = await prisma.organization.findUnique({
    where: {
      ownerId: user?.id,
    },
  });

  if (!getOrganizationAdmin) {
    throw new AppError(status.NOT_FOUND, "Organization not found");
  }
  // console.log(getOrganizationAdmin);
  // Build where clause for Call model
  let whereClause: any = {
    organizationId: getOrganizationAdmin?.id,
  };

  // console.log(whereClause, 450);

  // If search term exists, ADD search conditions to the existing whereClause
  if (searchTerm) {
    whereClause.AND = [
      {
        OR: [
          { from_number: { contains: searchTerm, mode: "insensitive" } },
          { to_number: { contains: searchTerm, mode: "insensitive" } },
          { call_status: { contains: searchTerm, mode: "insensitive" } },
          { callType: { contains: searchTerm, mode: "insensitive" } },
          {
            receivedBy: {
              user: {
                name: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
        ],
      },
    ];
  }
  // console.log(whereClause);

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        agentId: true,
        from_number: true,
        to_number: true,
        call_time: true,
        callType: true,
        call_status: true,
        call_duration: true,
        call_started_at: true,
        call_completed_at: true,
        call_transcript: true,
        recording_duration: true,
        recording_status: true,
        recording_url: true,
        receivedBy: {
          select: {
            id: true,
            droppedCalls: true,
            successCalls: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: Number(skip),
      take: Number(limit),
    }),
    prisma.call.count({
      where: whereClause,
    }),
  ]);

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: calls,
  };
};


const getPlatformOverviewStats = async (): Promise<any> => {
  try {
    // Execute all queries in parallel for efficiency
    const [
      totalOrganizations,
      totalHumanCalls,
      totalAICalls
    ] = await Promise.all([
      // Total organizations count
      prisma.organization.count(),

      // Total human calls (all statuses)
      prisma.call.count(),

      // Total AI calls (all statuses)
      prisma.aicalllogs.count()
    ]);

    const totalCalls = totalHumanCalls + totalAICalls;

    return {
      totalOrganizations,
      totalCalls,
      totalHumanCalls,
      totalAICalls
    };
  } catch (error) {
    console.error("Error fetching platform overview stats:", error);
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Failed to fetch platform overview statistics"
    );
  }
};

export const OrganizationServices = {
  getAllOrganizations,
  getPlatformOverviewStats,
  getOrganizationCallLogsManagement,
  getSingleOrganization,
};
