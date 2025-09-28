import config from "./app/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "./app/helpers/hashPassword";

const prisma = new PrismaClient();

export const seedSuperAdmin = async () => {
  const email = config.superAdmin.email!;
  const password = config.superAdmin.password!;
  const phone = config.superAdmin.phone!;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone }
      ]
    },
  });

  if (existingUser) {
    console.log("⚠️  Super Admin already exists!");
    return;
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.create({
    data: {
      name: "Uprank Marketing",
      email,
      phone,
      password: hashedPassword,
      role: UserRole.super_admin,
      isVerified: true,
    },
  });

  console.log("✅ Super Admin seeded successfully.");
};
