import { Prisma } from "@prisma/client";
import { IGenericErrorResponse } from "../interface/error";

const handleValidationError = (
  error: Prisma.PrismaClientValidationError
): IGenericErrorResponse => {
  const errors = [
    {
      path: "validation",
      message: error.message,
    },
  ];

  return {
    statusCode: 400,
    message: "Validation Error",
    errorMessages: errors,
  };
};

export default handleValidationError;
