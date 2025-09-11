import { UserRole } from "@prisma/client";
import prisma from "../../utils/prisma";

const getAllOrganizationAdmin = async (query: Record<string, unknown>) => {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const where: any = {
    role: UserRole.organization_admin,
    isDeleted: false,
  };

  // Add search functionality
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { email: { contains: search as string, mode: "insensitive" } },
      { phone: { contains: search as string, mode: "insensitive" } },
    ];
  }

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
        // createdAt: true,
        // updatedAt: true,
        ownedOrganization: {
          select: {
            id: true,
            name: true,
            industry: true,
            address: true,
            websiteLink: true,
            organizationNumber: true,
            subscriptions: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                amount: true,
                paymentStatus: true,
                status: true,
                planLevel: true,
                purchasedNumber: true,
                numberOfAgents: true,
                // createdAt: true,
                // updatedAt: true,
                // plan: {
                //   select: {
                //     id: true,
                //     planName: true,
                //     amount: true,
                //     currency: true,
                //     interval: true,
                //     intervalCount: true,
                //     description: true,
                //     features: true,
                //     planLevel: true,
                //     createdAt: true,
                //     updatedAt: true
                //   }
                // }
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            agents: true,
          },
        },
      },
      orderBy: {
        [sortBy as string]: sortOrder,
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

export const ClientManagementServices = {
  getAllOrganizationAdmin,
};
