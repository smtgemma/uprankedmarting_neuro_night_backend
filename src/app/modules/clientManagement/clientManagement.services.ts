import { AssignmentStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import prisma from "../../utils/prisma";
const getAllOrganizationAdmin = async (query: Record<string, unknown>) => {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    hasAgents, // "true" | "false" | undefined
  } = query;

  const where: any = {
    role: UserRole.organization_admin,
  };

  //  Add search filter
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { email: { contains: search as string, mode: "insensitive" } },
      { phone: { contains: search as string, mode: "insensitive" } },
    ];
  }

  //  STEP 1: Get all organization IDs that currently have ASSIGNED agents
  const activeAssignedOrgIds = await prisma.agentAssignment.findMany({
    where: { status: AssignmentStatus.ASSIGNED },
    distinct: ["organizationId"],
    select: { organizationId: true },
  });

  console.log("activeAssignedOrgIds", activeAssignedOrgIds);

  const orgIdsWithAgents = activeAssignedOrgIds.map((a) => a.organizationId);

  //  STEP 2: Filter users based on `hasAgents`
  if (hasAgents === "true") {
    where.ownedOrganization = {
      id: { in: orgIdsWithAgents },
    };
  } else if (hasAgents === "false") {
    where.ownedOrganization = {
      id: { notIn: orgIdsWithAgents },
    };
  }

  // STEP 3: Fetch users efficiently
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        bio: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        ownedOrganization: {
          select: {
            id: true,
            name: true,
            industry: true,
            address: true,
            websiteLink: true,
            organizationNumber: true,
            subscriptions: {
              where: { status: SubscriptionStatus.ACTIVE },
              select: {
                id: true,
                trialStart: true,
                trialEnd: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                canceledAt: true,
                planLevel: true,
                purchasedNumber: true,
                sid: true,
                numberOfAgents: true,
                status: true,
                plan: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  //  STEP 4: Return final structured response
  return {
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
    data: users,
  };
};


export const ClientManagementServices = {
  getAllOrganizationAdmin
};
