import { UserRole } from "@prisma/client";
import prisma from "../../utils/prisma";
import QueryBuilder from "../../builder/QueryBuilder";

const getAllOrganizationAdmin = async (query: Record<string, unknown>) => {
  // console.log("Query:4353")
  const agentFeedbackQuery = new QueryBuilder(prisma.user, query)
    .search(["name", "email", "phone"])
    .rawFilter({ role: UserRole.organization_admin, isDeleted: false })
    // .filter()
    // .select({
    //   phone: true,
    //   name: true,
    //   email: true,
    //   image: true,
    //   bio: true,
    //   role: true,
    //   status: true,
    //   ownedOrganization: true,
    // })
    .sort()
    .paginate()
    .fields();

  const result = await agentFeedbackQuery.execute();
  const meta = await agentFeedbackQuery.countTotal();

  //   const result = await prisma.user.findMany({
  //     where: {
  //       role: UserRole.organization_admin, // Only get organization admins
  //       isDeleted: false // Exclude deleted users,
  //     },
  //     select: {
  //       id: true,
  //       phone: true,
  //       name: true,
  //       email: true,
  //       image: true,
  //       bio: true,
  //       role: true,
  //       status: true,
  //       ownedOrganization: true,
  //     },
  //     orderBy: {
  //       createdAt: 'desc'
  //     }
  //   });

  return result;
};

export const ClientManagementServices = {
  getAllOrganizationAdmin,
};
