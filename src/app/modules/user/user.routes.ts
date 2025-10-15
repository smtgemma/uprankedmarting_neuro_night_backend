import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { UserController } from "./user.controller";
import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";

// const router = Router();

// router.get("/", UserController.getAllUser);

// router.get(
//   "/:userId",
//   // auth(UserRole.SUPER_ADMIN),
//   UserController.getSingleUserById
// );

// // router.post("/agent/answer-call", async (req, res) => {
// //   const { call_sid, agent_id } = req.body;
// //   const twiml = new twilio.twiml.VoiceResponse();
// //   try {
// //     twiml.dial().client(`agent_${agent_id}`);
// //     await prisma.call.update({
// //       where: { call_sid },
// //       data: { status: "IN_PROGRESS", receiverId: agent_id },
// //     });
// //     res.type("text/xml");
// //     res.send(twiml.toString());
// //   } catch (error) {
// //     console.error("Answer call error:", error);
// //     res.status(500).json({ success: false, detail: "Failed to answer call" });
// //   }
// // });

// // router.post("/agent/update-status", async (req, res) => {
// //   const { agentId, status } = req.body;
// //   const client = require("twilio")(
// //     process.env.TWILIO_ACCOUNT_SID,
// //     process.env.TWILIO_AUTH_TOKEN
// //   );
// //   try {
// //     const activitySid =
// //       status === "Available"
// //         ? process.env.TWILIO_AVAILABLE_ACTIVITY_SID
// //         : status === "Busy"
// //         ? process.env.TWILIO_BUSY_ACTIVITY_SID
// //         : process.env.TWILIO_OFFLINE_ACTIVITY_SID;
// //     await client.taskrouter.v1
// //       .workspaces(process.env.TWILIO_WORKSPACE_SID)
// //       .workers(`WK${agentId}`)
// //       .update({ activitySid });
// //     await prisma.agent.update({
// //       where: { userId: agentId },
// //       data: { status: status.toUpperCase() },
// //     });
// //     res.json({ success: true });
// //   } catch (error) {
// //     console.error("Status update error:", error);
// //     res.status(500).json({ error: "Failed to update status" });
// //   }
// // });

// router.post("/register-user", UserController.createUser);
// router.post("/register-agent", UserController.createAgent);

// router.post(
//   "/verify-otp",
//   // validateRequest(UserValidation.verifyOTPSchema),
//   UserController.verifyOTP
// );

// router.patch(
//   "/update",
//   multerUpload.single("file"),
//   auth(UserRole.organization_admin, UserRole.super_admin),
//   (req: Request, res: Response, next: NextFunction) => {
//     const file = req.file;
//     if (req?.body?.data) {
//       req.body = JSON.parse(req?.body?.data);
//     }
//     if (file) {
//       req.body.image = file?.path;
//     }

//     // validateRequest(UserValidation.updateUserValidationSchema),
//     UserController.updateUser(req, res, next);
//   }
// );

// router.patch(
//   "/agent-info/update/:id",
//   multerUpload.single("file"),
//   auth(UserRole.super_admin),
//   (req: Request, res: Response, next: NextFunction) => {
//     const file = req.file;
//     if (req?.body?.data) {
//       req.body = JSON.parse(req?.body?.data);
//     }
//     if (file) {
//       req.body.image = file?.path;
//     }

//     // validateRequest(UserValidation.updateUserValidationSchema),
//     UserController.updateAgentInfo(req, res, next);
//   }
// );

// router.patch(
//   "/agents/profile",

//   multerUpload.single("file"),
//   auth(UserRole.agent),
//   (req: Request, res: Response, next: NextFunction) => {
//     const file = req.file;
//     if (file) {
//       req.body.image = file?.path;
//     }

//     UserController.updateAgentSpecificInfo(req, res, next);
//   }
// );

// router.patch(
//   "/user-role-status/update/:userId",
//   auth(UserRole.super_admin),
//   UserController.updateUserRoleStatusByAdminIntoDB
// );
// export const UserRoutes = router;


const router = Router();

router.get("/", UserController.getAllUser);

router.get(
  "/:userId",
  // auth(UserRole.SUPER_ADMIN),
  UserController.getSingleUserById
);

router.post("/register-user", UserController.createUser);
router.post("/register-agent",auth(UserRole.organization_admin), UserController.createAgent);

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