export type OTPData = {
  otp: number;
  expiresAt: Date;
};

export const generateOTPData = (
  length: number = 4,
  expiresInMinutes: number = 5
): OTPData => {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  return {
    otp: parseInt(otp),
    expiresAt,
  };
};