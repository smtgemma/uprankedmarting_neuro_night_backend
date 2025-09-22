import status from "http-status";
import prisma from "./prisma";
import ApiError from "../errors/AppError";
export const generateUniqueEmployeeId = async (): Promise<string> => {
  try {
    const lastAgent = await prisma.agent.findFirst({
      select: { employeeId: true },
      orderBy: { employeeId: "desc" },
    });


    let newIdNum: number;

    if (lastAgent?.employeeId) {
      const lastIdNum = parseInt(lastAgent.employeeId.replace("EMP", ""), 10);
      newIdNum = isNaN(lastIdNum) ? 1 : lastIdNum + 1;
    } else {
      newIdNum = 1;
    }

    return `EMP${newIdNum.toString().padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating employee ID:", error);
     throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      "Could not generate employee ID"
    );
  }
};
