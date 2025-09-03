import { Request } from "express";
import { PrismaClient, DocFor } from "@prisma/client";
import QueryBuilder from "../../builder/QueryBuilder";
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "../../utils/pdfExtractor";
import { extractTextFromDocx } from "../../utils/docxExtractor";
import prisma from "../../utils/prisma";

const removeFileExtensionRegex = /\.(pdf|docx)$/i;

const removeFileExtension = (filename: string): string => {
  return filename.replace(removeFileExtensionRegex, "");
};

const createCompanyDoc = async (req: Request) => {
  const { docFor } = req.body;
  const file = req.file;

  const user = req.user;

  const Organization = await prisma.organization.findUnique({
    where: { ownerId: user?.id , },
  });

  if (!Organization) {
    throw new Error("Organization not found for the user");
  }

  if (!file) {
    throw new Error("No file uploaded");
  }

  //   if (!(await fs.access(file.path).then(() => true).catch(() => false))) {
  //     console.error("File not found at path:", file.path);
  //     throw new Error(`File not found: ${file.path}`);
  //   }

  let content = {};

  try {
    if (file.mimetype === "application/pdf") {
      // console.log("Extracting text from PDF...");
      content = await extractTextFromPDF(file.path);
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // console.log("Extracting text from DOCX...");
      content = await extractTextFromDocx(file.path);
    } else {
      throw new Error("Unsupported file type");
    }

    const cleanedDocName = removeFileExtension(file.originalname);

    const companyDoc = await prisma.organizationDoc.create({
      data: {
        organizationId: Organization?.id,
        docFor: docFor as DocFor,
        content,
        aiDocId: file.filename,
        aiDocName: cleanedDocName,
      },
      include: {
        organization: true,
      },
    });

    return companyDoc;
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  } finally {
    try {
      await fs.unlink(file.path, () => {
        console.log(`File deleted: ${file.path}`);
      });
    } catch (deleteError) {
      console.error(`Failed to delete file ${file.path}:`, deleteError);
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

const getCompanyDocsByCompany = async (
  organizationId: string,
  query: Record<string, unknown>
) => {
  const companyDocQuery = new QueryBuilder(prisma.organizationDoc, query)
    .rawFilter({ organizationId })
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
  const { organizationId, docFor } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const existingDoc = await prisma.organizationDoc.findUnique({
    where: { id },
  });

  let content = existingDoc?.content || {};
  let aiDocId = existingDoc?.aiDocId || null;
  let aiDocName = existingDoc?.aiDocName || null;

  // Handle file upload and text extraction if new file is provided
  if (
    files &&
    ((files.aiDocument && docFor === "AI") ||
      (files.agentDocument && docFor === "AGENT"))
  ) {
    const fileField = docFor === "AI" ? "aiDocument" : "agentDocument";
    const file = files[fileField]?.[0];

    if (file) {
      // Delete old file if exists
      if (existingDoc?.aiDocId) {
        const oldFilePath = path.join(
          process.cwd(),
          "uploads",
          existingDoc.aiDocId
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      aiDocId = file.filename;
      aiDocName = file.originalname;

      // Extract text based on file type
      try {
        if (file.mimetype === "application/pdf") {
          content = await extractTextFromPDF(file.path);
        } else if (
          file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          content = await extractTextFromDocx(file.path);
        } else {
          throw new Error("Unsupported file type");
        }
      } catch (error) {
        // Clean up uploaded file if text extraction fails
        fs.unlinkSync(file.path);
        throw error;
      }
    }
  }

  return await prisma.organizationDoc.update({
    where: { id },
    data: {
      organizationId,
      docFor: docFor as DocFor,
      content,
      aiDocId,
      aiDocName,
    },
    include: {
      organization: true,
    },
  });
};

const deleteCompanyDoc = async (id: string) => {
  const doc = await prisma.organizationDoc.findUnique({ where: { id } });

  // Delete associated file if exists
  if (doc?.aiDocId) {
    const filePath = path.join(process.cwd(), "uploads", doc.aiDocId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  return await prisma.organizationDoc.delete({
    where: { id },
  });
};

export const CompanyDocServices = {
  createCompanyDoc,
  getAllCompanyDocs,
  getSingleCompanyDoc,
  getCompanyDocsByCompany,
  getCompanyDocsByType,
  updateCompanyDoc,
  deleteCompanyDoc,
};
