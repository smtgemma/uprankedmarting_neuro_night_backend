import { Request, Response, NextFunction } from 'express';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  // console.log('Headers:', req.headers);
  // console.log('Body:', req.body);
  next();
};