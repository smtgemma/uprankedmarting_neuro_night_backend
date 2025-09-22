import cors from "cors";
import path from "path";
import router from "./app/routes";
import cookieParser from "cookie-parser";
import notFound from "./app/middlewares/notFound";
import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { requestLogger } from "./app/middlewares/requestLogger";
import { apiLimiter, authLimiter } from "./app/utils/rateLimiter";
import { scheduleExpirationJob } from "./app/modules/subscription/subscriptionExpirationJob";

const app: Application = express();
app.set("trust proxy", 1); 

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


const allowedOrigins = [
  "http://localhost:3000", 
  "http://localhost:3001", 
  "http://localhost:3002",
  "http://localhost:3003", // React local
  "http://localhost:3004", // React local
  "http://10.0.30.84:3000", // অন্য client
  "https://your-production-frontend-url.com", // deployed client
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // cookie/session allow করবে
  })
);


// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // allow requests with no origin (like mobile apps or curl requests)
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.indexOf(origin) === -1) {
//         const msg =
//           "The CORS policy for this site does not allow access from the specified Origin.";
//         return callback(new Error(msg), false);
//       }
//       return callback(null, true);
//     },
//     credentials: true,
//   })
// );

// Request Logger Middleware (Add this)
app.use(requestLogger);

// Apply to all routes
app.use("/api/v1", apiLimiter);

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/users/register-user", authLimiter);

// app routes
app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send({
    Message: "Uprank server is running...",
  });
});

// Initialize subscription expiration job
try {
  scheduleExpirationJob();
} catch (error) {
  console.error("Failed to schedule expiration job:", error);
}

app.use(globalErrorHandler);
app.use(notFound);

export default app;
