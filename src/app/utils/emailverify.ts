
import jwt from 'jsonwebtoken';

const JWT_SECRET_VERIFY = process.env.JWT_SECRET_VERIFY!;

export const generateVerificationToken = async(email: string) => {
  return jwt.sign({ email }, "f89ncvskduf89739hf873", { expiresIn: '10m' });
};
