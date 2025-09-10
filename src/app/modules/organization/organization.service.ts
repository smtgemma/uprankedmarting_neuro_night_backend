import status from "http-status";
// import QueryBuilder from "../../builder/QueryBuilder";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";

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

// const createOrganization = async (payload: any) => {
//   const { name, address, websiteLink, organizationNumber, ownerId, sipDomain, agentVoiceUrl, leadQuestions } = payload;

//   // Verify owner exists and is organization_admin
//   const owner = await prisma.user.findUnique({
//     where: { id: ownerId },
//   });
//   if (!owner || owner.role !== "organization_admin") {
//     throw new AppError(status.BAD_REQUEST, "Invalid or non-admin owner");
//   }

//   // Check for unique organizationNumber
//   if (organizationNumber) {
//     const existingOrg = await prisma.organization.findUnique({
//       where: { organizationNumber },
//     });
//     if (existingOrg) {
//       throw new AppError(status.BAD_REQUEST, "Organization number already exists");
//     }
//   }

//   const organization = await prisma.organization.create({
//     data: {
//       name,
//       address,
//       websiteLink,
//       organizationNumber,
//       ownerId,
//       sipDomain,
//       agentVoiceUrl,
//       leadQuestions,
//     },
//     include: {
//       ownedOrganization: {
//         select: { id: true, name: true, email: true },
//       },
//     },
//   });

//   return organization;
// };

// const updateOrganization = async (organizationId: string, userId: string, userRole: string, payload: any) => {
//   const organization = await prisma.organization.findUnique({
//     where: { id: organizationId },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   if (userRole === "organization_admin" && organization.ownerId !== userId) {
//     throw new AppError(status.FORBIDDEN, "You can only update your own organization");
//   }

//   if (payload.organizationNumber) {
//     const existingOrg = await prisma.organization.findUnique({
//       where: { organizationNumber: payload.organizationNumber },
//     });
//     if (existingOrg && existingOrg.id !== organizationId) {
//       throw new AppError(status.BAD_REQUEST, "Organization number already exists");
//     }
//   }

//   const updatedOrganization = await prisma.organization.update({
//     where: { id: organizationId },
//     data: payload,
//     include: {
//       ownedOrganization: {
//         select: { id: true, name: true, email: true },
//       },
//       subscriptions: {
//         include: { plan: true },
//       },
//     },
//   });

//   return updatedOrganization;
// };

// const deleteOrganization = async (organizationId: string, userId: string, userRole: string) => {
//   const organization = await prisma.organization.findUnique({
//     where: { id: organizationId },
//     include: { subscriptions: true },
//   });

//   if (!organization) {
//     throw new AppError(status.NOT_FOUND, "Organization not found");
//   }

//   if (userRole === "organization_admin" && organization.ownerId !== userId) {
//     throw new AppError(status.FORBIDDEN, "You can only delete your own organization");
//   }

//   // Check for active subscriptions
//   const activeSubscriptions = organization.subscriptions.filter(
//     (sub) => sub.status === "ACTIVE"
//   );
//   if (activeSubscriptions.length > 0) {
//     throw new AppError(status.BAD_REQUEST, "Cannot delete organization with active subscriptions");
//   }

//   // Cancel Stripe subscriptions
//   for (const sub of organization.subscriptions) {
//     if (sub.sid) {
//       try {
//         await prisma.stripe.subscriptions.cancel(sub.sid);
//       } catch (error) {
//         console.error(`Error canceling Stripe subscription ${sub.sid}:`, error);
//       }
//     }
//   }

//   // Delete related subscriptions
//   await prisma.subscription.deleteMany({
//     where: { organizationId },
//   });

//   const result = await prisma.organization.delete({
//     where: { id: organizationId },
//   });

//   return result;
// };

export const OrganizationServices = {
  getAllOrganizations,
  getSingleOrganization,
  //   createOrganization,
  //   updateOrganization,
  //   deleteOrganization,
};
