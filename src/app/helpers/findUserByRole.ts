import { User } from "@prisma/client";
// import status from "http-status";
// import AppError from "../errors/AppError";
// import prisma from "../utils/prisma";

export const findProfileByRole = async (user: User) => {
  let profile = null;

  // if (user.role === UserRole.organization_admin) {
  //   profile = await prisma.user.findUnique({ where: { userId: user.id } });
  //   if (!profile) {
  //     throw new AppError(status.NOT_FOUND, "Client profile not found");
  //   }
  // } else if (user.role === UserRole.AGENT) {
  //   profile = await prisma.agent.findUnique({ where: { userId: user.id } });
  //   if (!profile) {
  //     throw new AppError(status.NOT_FOUND, "Agent profile not found");
  //   }
  // } else {
  //   throw new AppError(
  //     status.FORBIDDEN,
  //     `${user.role} is not allowed to perform this action`
  //   );
  // }

  return profile;
};
