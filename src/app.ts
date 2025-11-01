import cors from "cors";
import path from "path";

import cookieParser from "cookie-parser";

import express, { Application, Request, Response } from "express";
import { requestLogger } from "./app/middlewares/requestLogger";
import { SubscriptionController } from "./app/modules/subscription/subscription.controller";
import { apiLimiter, authLimiter } from "./app/utils/rateLimiter";
import router from "./app/routes";
import GlobalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";

const app: Application = express();
app.set("trust proxy", 1);

// ====================
// 1. RAW BODY FOR WEBHOOK (MUST BE FIRST)
// ====================
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      if (req.originalUrl === "/stripe/webhook") {
        req.rawBody = buf.toString();
      }
    },
  })
);

app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ====================
// 2. CORS
// ====================
const allowedOrigins = [
  "https://answersmart.ai",
  "https://www.answersmart.ai",
  "https://aibackend.answersmart.ai",
  "https://backend.answersmart.ai",
  "https://lead.answersmart.ai",
  "http://localhost:3000",
  "https://47bc5cdc91c2.ngrok-free.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ====================
// 3. REQUEST LOGGER
// ====================
app.use(requestLogger);

// ====================
// 4. STRIPE WEBHOOK ROUTE (DIRECT, NO PREFIX, NO LIMITER)
// ====================
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }), // ← Ensures raw body
  SubscriptionController.handleWebhook
);

// ====================
// 5. API ROUTES (WITH LIMITER)
// ====================
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/users/register-user", authLimiter);
app.use("/api/v1", router);

// ====================
// 6. HEALTH CHECK
// ====================
app.get("/", (req: Request, res: Response) => {
  res.send({
    Message: "AnswerSmart server is running...",
    // webhook: "POST /stripe/webhook",
  });
});

// ====================
// 7. ERROR HANDLERS
// ====================
app.use(GlobalErrorHandler);
app.use(notFound);

export default app;
