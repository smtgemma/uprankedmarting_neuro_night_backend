// import crypto from "crypto";

// type OTPTokenResult = {
//   token: string;
//   otp: string;
//   expiresAt: number;
// };

// /**
//  * Generate a numeric OTP of specified length.
//  */
// export const generateOTP = (length: number = 6): string => {
//   let otp = '';
//   for (let i = 0; i < length; i++) {
//     otp += Math.floor(Math.random() * 10).toString();
//   }
//   return otp;
// };

// /**
//  * Generate a hashed token for OTP verification with expiration.
//  */
// export const generateOTPToken = (
//   otp: string,
//   expiresInMinutes: number = 5
// ): OTPTokenResult => {
//   const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
//   const data = `${otp}.${expiresAt}`;
//   const secret = process.env.OTP_SECRET || "default_secret";

//   const hash = crypto.createHmac("sha256", secret).update(data).digest("hex");

//   return {
//     token: `${hash}.${expiresAt}`,
//     otp,
//     expiresAt,
//   };
// };

// /**
//  * Verify OTP by comparing hashes and checking expiration.
//  */
// export const verifyOTP = (otp: string, token: string): boolean => {
//   const [hashFromToken, expiresAtStr] = token.split(".");
//   const expiresAt = parseInt(expiresAtStr, 10);

//   if (Date.now() > expiresAt) return false;

//   const data = `${otp}.${expiresAt}`;
//   const secret = process.env.OTP_SECRET || "default_secret";

//   const expectedHash = crypto.createHmac("sha256", secret).update(data).digest("hex");

//   return hashFromToken === expectedHash;
// };
export type OTPData = {
  otp: string;
  expiresAt: Date;
};

export const generateOTPData = (
  length: number = 6,
  expiresInMinutes: number = 5
): OTPData => {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  return {
    otp,
    expiresAt,
  };
};