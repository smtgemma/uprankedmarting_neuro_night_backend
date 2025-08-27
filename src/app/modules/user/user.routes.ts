import status from "http-status";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { upload } from "../../utils/upload";
import ApiError from "../../errors/AppError";
import { UserValidation } from "./user.validation";
import { UserController } from "./user.controller";
import validateRequest from "../../middlewares/validateRequest";
import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";

const router = Router();

router.get("/",auth(UserRole.super_admin), UserController.getAllUser);

router.get(
  "/:userId",
  // auth(UserRole.SUPER_ADMIN),
  UserController.getSingleUserById
);

router.post("/register", UserController.createUser);

router.patch(
  "/update",
  auth(UserRole.organization_admin, UserRole.super_admin),
  multerUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (req?.body?.data) {
      req.body = JSON.parse(req?.body?.data);
    }
    if (file) {
      req.body.image = file?.path;
    }

    validateRequest(UserValidation.updateUserValidationSchema),
    UserController.updateUser(req, res, next);
  }
);

router.patch(
   "/agent-info/update/:id",
  auth(UserRole.organization_admin, UserRole.super_admin),
  multerUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (req?.body?.data) {
      req.body = JSON.parse(req?.body?.data);
    }
    if (file) {
      req.body.image = file?.path;
    }

    // validateRequest(UserValidation.updateUserValidationSchema),
    UserController.updateAgentInfo(req, res, next);
  }
)

router.patch(
  "/user-role-status/update/:userId",
  auth(UserRole.super_admin),
  UserController.updateUserRoleStatusByAdminIntoDB
);
export const UserRoutes = router;
