import { PrismaClient } from "@prisma/client";


const extractUsernameFromEmail = (email: string): string => {
  const match = email.match(/^([^@]+)/); // @ এর আগের অংশ
  return match ? match[1].toLowerCase() : "";
};

// const username = generateUniqueUsernameFromEmail(payload.email);

export const generateUniqueUsernameFromEmail = async (
  email: string
): Promise<string> => {
  const baseId = extractUsernameFromEmail(email); // first portion of email
  let uniqueId = baseId;

  //  random number (1000 - 9999)
  const randomNum = Math.floor(1000 + Math.random() * 90000);

  uniqueId = `${baseId}${randomNum}`;

  return uniqueId;
};
