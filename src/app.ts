import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import router from "./app/routes";
import cookieParser from "cookie-parser";
import notFound from "./app/middlewares/notFound";
import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { requestLogger } from "./app/middlewares/requestLogger";

const app: Application = express();

// parsers
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// Update CORS to include your deployed frontend URL
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Local dev
      "http://10.0.30.84:3000", // Production frontend
    ],
    credentials: true,
  })
);

// Request Logger Middleware (Add this)
app.use(requestLogger);

// app routes
app.use("/api/v1", router);

// Test route
app.get("/", (req: Request, res: Response) => {
  res.send({
    Message: "The server is running...",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
