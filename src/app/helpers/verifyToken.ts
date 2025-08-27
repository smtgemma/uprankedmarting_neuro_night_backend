import config from "../config";
import status from "http-status";
import AppError from "../errors/AppError";
import jwt, { JwtPayload } from "jsonwebtoken";

export const verifyToken = (
  token: string,
  secret = config.jwt.access.secret as string
): JwtPayload => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new AppError(status.UNAUTHORIZED, "JWT token is expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new AppError(status.UNAUTHORIZED, "Invalid JWT token");
    } else {
      throw new AppError(status.UNAUTHORIZED, "Failed to verify token");
    }
  }
};
