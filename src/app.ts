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

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(cors());

app.use(requestLogger);

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send({
    Message: "Uprank server is running...",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;