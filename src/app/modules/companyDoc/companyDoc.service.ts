import { AgentStatus, AssignmentStatus, DocFor, User } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import prisma from "../../utils/prisma";
import AppError from "../../errors/AppError";
import status from "http-status";
import fs from "fs";
import { Request, Response } from "express";
import { uploadToCloudinary } from "../../config/cloudinary.config";

// // Helper function to remove file extension
const removeFileExtension = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, "");
};
// Helper function to get file extension
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
};


// Create company document controller - FIXED VERSION
const createCompanyDoc = async (req: Request, res: Response) => {
  try {
    const { docFor } = req.body;
    const file = req.file;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const Organization = await prisma.organization.findUnique({
      where: { ownerId: user.id },
    });

    if (!Organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found for the user",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const cleanedDocName = removeFileExtension(file?.originalname);
    const fileExtension = getFileExtension(file?.originalname);

    // Upload file to Cloudinary with proper resource type
    const cloudinaryResult = await uploadToCloudinary(file.path, file.mimetype);

    // Generate proper download URL (fix for PDFs treated as images)
    let downloadUrl = cloudinaryResult.secure_url;
    if (
      fileExtension === "pdf" &&
      downloadUrl.includes("/image/upload/")
    ) {
      downloadUrl = downloadUrl.replace("/image/upload/", "/raw/upload/");
    }

    const companyDoc = await prisma.organizationDoc.create({
      data: {
        organizationId: Organization.id,
        docFor: docFor || "AGENT",
        fileName: cleanedDocName,
        cloudUrl: downloadUrl, // Use the corrected URL
        fileFormat: fileExtension,
      },
      include: {
        organization: true,
      },
    });

    // Clean up the uploaded file
    try {
      fs.unlinkSync(file.path);
      console.log(`File deleted locally: ${file.path}`);
    } catch (deleteError) {
      console.error(`Failed to delete file ${file.path}:, deleteError`);
    }

    return companyDoc;
  } catch (error) {
    console.error("Error processing document:", error);

    // Clean up file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error(`Failed to delete file ${req.file.path}:, deleteError`);
      }
    }
  }
};

const getAllCompanyDocs = async (query: Record<string, unknown>) => {
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .filter()
    .sort()
    .paginate()
    .fields();
  // .include({ organization: true });

  const result = await companyDocQuery.execute();
  const meta = await companyDocQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getSingleCompanyDoc = async (id: string) => {
  return await prisma.organizationDoc.findUnique({
    where: { id },
    include: { organization: true },
  });
};

const getCompanyDocsByOrgAdmin = async (
  query: Record<string, unknown>,
  user: User
) => {
  // console.log(user?.id)
  const Organization = await prisma.organization.findUnique({
    where: { ownerId: user?.id },
  });

  if (!Organization) {
    throw new AppError(status.NOT_FOUND, "Organization not found for the user");
  }
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .rawFilter({ organizationId: Organization?.id })
    .sort()
    .paginate()
    .fields();
  // .include({ organization: true });

  const result = await companyDocQuery.execute();
  const meta = await companyDocQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getCompanyDocsByOrgnizationId = async (
  organizationId: string,
  query: Record<string, unknown>
) => {
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .rawFilter({ organizationId })
    .sort()
    .paginate()
    .fields();
  // .include({ organization: true });

  if (!companyDocQuery) {
    throw new AppError(status.NOT_FOUND, "Organization not found for the user");
  }
  const result = await companyDocQuery.execute();
  const meta = await companyDocQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getCompanyDocsByAssignedAgent = async (
  query: Record<string, unknown>,
  user: User
) => {
  // First, check if the user is an agent
  const agent = await prisma.agent.findUnique({
    where: { userId: user.id },
    include: {
      assignments: {
        where: {
          status: AssignmentStatus.ASSIGNED
        },
        include: {
          organization: true
        }
      }
    }
  });

  if (!agent) {
    throw new AppError(status.NOT_FOUND, "Agent not found for the user");
  }

  if (agent.assignments.length === 0) {
    throw new AppError(
      status.NOT_FOUND, 
      "No organization assignments found for this agent"
    );
  }

  // Get all organization IDs where the agent is assigned
  const organizationIds = agent.assignments.map(assignment => assignment.organizationId);

  // console.log(organizationIds)
  // Query documents for all assigned organizations
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .rawFilter({ 
      organizationId: { 
        in: organizationIds 
      } 
    })
    .sort()
    .paginate()
    .fields()
    .include({ 
      organization: {
        select: {
          id: true,
          name: true,
          industry: true
        }
      } 
    });

  const result = await companyDocQuery.execute();
  const meta = await companyDocQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const getCompanyDocsByType = async (
  docFor: DocFor,
  query: Record<string, unknown>
) => {
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .rawFilter({ docFor })
    .sort()
    .paginate()
    .fields()
    .include({ organization: true });

  const result = await companyDocQuery.execute();
  const meta = await companyDocQuery.countTotal();

  return {
    meta,
    data: result,
  };
};

const updateCompanyDoc = async (id: string, req: Request) => {
  // const { organizationId, docFor } = req.body;
  // const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  // const existingDoc = await prisma.organizationDoc.findUnique({
  //   where: { id },
  // });
  // // Handle file upload and text extraction if new file is provided
  // if (
  //   files &&
  //   ((files.aiDocument && docFor === "AI") ||
  //     (files.agentDocument && docFor === "AGENT"))
  // ) {
  //   const fileField = docFor === "AI" ? "aiDocument" : "agentDocument";
  //   const file = files[fileField]?.[0];
  //   if (file) {
  //     // Delete old file if exists
  //     if (existingDoc?.aiDocId) {
  //       const oldFilePath = path.join(
  //         process.cwd(),
  //         "uploads",
  //         existingDoc.aiDocId
  //       );
  //       if (fs.existsSync(oldFilePath)) {
  //         fs.unlinkSync(oldFilePath);
  //       }
  //     }
  //     aiDocId = file.filename;
  //     aiDocName = file.originalname;
  //     // Extract text based on file type
  //     try {
  //       if (file.mimetype === "application/pdf") {
  //         content = await extractTextFromPDF(file.path);
  //       } else if (
  //         file.mimetype ===
  //         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  //       ) {
  //         content = await extractTextFromDocx(file.path);
  //       } else {
  //         throw new Error("Unsupported file type");
  //       }
  //     } catch (error) {
  //       // Clean up uploaded file if text extraction fails
  //       fs.unlinkSync(file.path);
  //       throw error;
  //     }
  //   }
  // }
  // return await prisma.organizationDoc.update({
  //   where: { id },
  //   data: {
  //     organizationId,
  //     docFor: docFor as DocFor,
  //     content,
  //     aiDocId,
  //     aiDocName,
  //   },
  //   include: {
  //     organization: true,
  //   },
  // });
};

const deleteCompanyDoc = async (id: string, user: User) => {
  // console.log(user);
  const doc = await prisma.organizationDoc.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (doc?.organization?.ownerId !== user.id) {
    throw new AppError(
      status.UNAUTHORIZED,
      "You are not authorized to delete this document!"
    );
  }

  return await prisma.organizationDoc.delete({
    where: { id },
  });
};

export const CompanyDocServices = {
  createCompanyDoc,
  getCompanyDocsByOrgnizationId,
  getCompanyDocsByAssignedAgent,
  getAllCompanyDocs,
  getSingleCompanyDoc,
  getCompanyDocsByOrgAdmin,
  getCompanyDocsByType,
  updateCompanyDoc,
  deleteCompanyDoc,
};
