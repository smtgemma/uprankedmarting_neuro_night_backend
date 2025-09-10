import { UserRole } from "@prisma/client";
import prisma from "../../utils/prisma";

const getAllOrganizationAdmin = async () => {

  const result = await prisma.user.findMany({
    where: {
      role: UserRole.organization_admin, // Only get organization admins
      isDeleted: false // Exclude deleted users,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      role: true,
      status: true,
      ownedOrganization: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return result;
};


export const ClientManagementServices = {
  getAllOrganizationAdmin,
};