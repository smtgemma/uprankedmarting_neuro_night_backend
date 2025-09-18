import { v2 as cloudinary } from 'cloudinary';
import config from './index';
import multer from "multer";
import path from "path";
import fs from "fs";

cloudinary.config({
  cloud_name: config.cloudinary.cloudinary_cloud_name,
  api_key: config.cloudinary.cloudinary_api_key,
  api_secret: config.cloudinary.cloudinary_api_secret,
});

export const cloudinaryUpload = cloudinary;

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

export const uploadDocument = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, DOC, DOCX, XLS, and XLSX files are allowed."
        )
      );
    }
  },
});


// Upload to Cloudinary function - FIXED VERSION
export const uploadToCloudinary = async (filePath: string, originalMimeType: string): Promise<any> => {
  try {
    // Determine resource type based on file type
    let resourceType: "auto" | "raw" = "auto";
    
    // Force raw upload for documents to prevent Cloudinary from treating them as images
    if (originalMimeType.includes('pdf') || 
        originalMimeType.includes('document') || 
        originalMimeType.includes('sheet')) {
      resourceType = "raw";
    }

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "company_docs",
      use_filename: true,
      unique_filename: true,
      resource_type: resourceType,
    });
    return result;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    throw err;
  }
};