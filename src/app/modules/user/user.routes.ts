import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { UserController } from "./user.controller";
import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";

const router = Router();

router.get("/", UserController.getAllUser);

router.get(
  "/:userId",
  // auth(UserRole.SUPER_ADMIN),
  UserController.getSingleUserById
);

router.post("/register-user", UserController.createUser);
router.post("/register-agent", UserController.createAgent);

router.post(
  "/verify-otp",
  // validateRequest(UserValidation.verifyOTPSchema),
  UserController.verifyOTP
)

router.post(
  "/forgot-password",
  validateRequest(UserValidation.forgotPasswordSchema),
  UserController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(UserValidation.resetPasswordSchema),
  UserController.resetPassword
);

router.patch(
  "/update",
  multerUpload.single("file"),
  auth(UserRole.organization_admin, UserRole.super_admin),
  (req: Request, res: Response, next: NextFunction) => {
    const file = req?.file;
    // console.log("file", file)
    if (req?.body?.data) {
      req.body = JSON.parse(req?.body?.data);
    }
    if (file) {
      req.body.image = file?.path;
    }
    UserController.updateUser(req, res, next);
  }
);

router.patch(
  "/agent-info/update/:id",
  multerUpload.single("file"),
  auth(UserRole.super_admin),
  (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (req?.body?.data) {
      req.body = JSON.parse(req?.body?.data);
    }
    if (file) {
      req.body.image = file?.path;
    }
    UserController.updateAgentInfo(req, res, next);
  }
);

router.patch(
  "/agents/profile",
  multerUpload.single("file"),
  auth(UserRole.agent),
  (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (req?.body?.data) {
      req.body = JSON.parse(req?.body?.data);
    }
    if (file) {
      req.body.image = file?.path;
    }
    UserController.updateAgentSpecificInfo(req, res, next);
  }
);

router.patch(
  "/user-status/update/:userId",
  auth(UserRole.super_admin),
  UserController.updateUserStatusByAdminIntoDB
);

export const UserRoutes = router;