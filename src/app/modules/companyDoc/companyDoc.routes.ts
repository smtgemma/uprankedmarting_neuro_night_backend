import express, { NextFunction, Request, Response } from "express";
import { upload, uploadDocument } from "../../utils/upload";
import { CompanyDocController } from "./companyDoc.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

// router.post(
//   '/',
//   upload.fields([
//     { name: 'aiDocument', maxCount: 1 },
//     { name: 'agentDocument', maxCount: 1 }
//   ]),
//   CompanyDocController.createCompanyDoc
// );
// router.post(
//   '/',
//   upload.single('document'), // Single file with field name 'document'
//   (req: Request, res: Response, next: NextFunction) => {
//     const file = req.file;
//     if (req?.body?.data) {
//       req.body = JSON.parse(req?.body?.data);
//     }
//     if (file) {
//       req.body.image = file?.path;
//     }

//     CompanyDocController.createCompanyDoc(req, res, next);
//   }
// );

router.post(
  "/",
  uploadDocument.single("document"), 
  auth(UserRole.organization_admin),
  (req: Request, res: Response, next: NextFunction) => {
    console.log("File uploaded:", req.file);

    // Parse the JSON data from the 'data' field
    if (req.body?.data) {
      try {
        const jsonData = JSON.parse(req.body.data);
        req.body = { ...req.body, ...jsonData };
        console.log("Parsed data:", req.body);
      } catch (error) {
        return res.status(400).json({
          statusCode: 400,
          message: "Invalid JSON data in data field",
        });
      }
    }

    // Call the controller
    CompanyDocController.createCompanyDoc(req, res, next);
  }
);

router.get(
  "/",
  auth(UserRole.organization_admin),
  CompanyDocController.getAllCompanyDocs
);
router.get("/organization",auth(UserRole.organization_admin), CompanyDocController.getCompanyDocsByOrgAdmin);
router.get("/:id", CompanyDocController.getSingleCompanyDoc);
router.get("/organization/:organizationId",auth(UserRole.organization_admin, UserRole.super_admin), CompanyDocController.getCompanyDocsByOrgnizationId);
router.get("/type/:docFor", CompanyDocController.getCompanyDocsByType);
router.put(
  "/:id",
  upload.fields([
    { name: "aiDocument", maxCount: 1 },
    { name: "agentDocument", maxCount: 1 },
  ]),
  CompanyDocController.updateCompanyDoc
);
router.delete("/:id",auth(UserRole.organization_admin), CompanyDocController.deleteCompanyDoc);

export const CompanyDocRoutes = router;
