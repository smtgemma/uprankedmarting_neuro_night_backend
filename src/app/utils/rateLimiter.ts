import rateLimit from "express-rate-limit";

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

// Stricter limiter for login/auth routes
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 minutes
  max: 10, // 5 login attempts per 15 minutes
  message: {
    status: 429,
    message: "Too many login attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
