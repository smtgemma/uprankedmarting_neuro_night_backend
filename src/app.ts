import cors from "cors";
import path from "path";
import router from "./app/routes";
import cookieParser from "cookie-parser";
import notFound from "./app/middlewares/notFound";
import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { requestLogger } from "./app/middlewares/requestLogger";
import { scheduleExpirationJob } from "./app/modules/subscription/subscriptionExpirationJob";

const app: Application = express();

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(
  cors({
    origin: ["http://your-frontend-domain.com", "http://localhost:3000"], // Update with your frontend domains
    credentials: true,
  })
);

app.use(requestLogger);

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
