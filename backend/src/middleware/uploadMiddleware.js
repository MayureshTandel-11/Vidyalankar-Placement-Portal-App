const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx"]);
const MIME_FOR_EXT = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/resumes");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : ".pdf";
    const base =
      (req.user?.studentId && String(req.user.studentId).replace(/[^\w-]/g, "")) ||
      String(req.user?._id || "user");
    cb(null, `${base}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error("Only PDF, DOC, or DOCX files are allowed"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "File size must be less than 5MB",
          details: "Resume file size exceeds the maximum limit of 5MB",
        },
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Only one file can be uploaded",
          details: err.message,
        },
      });
    }
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        message: "File upload error",
        details: err.message,
      },
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        message: err.message || "File upload failed",
        details: "Invalid file or file format",
      },
    });
  }

  next();
};

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        message: "No file uploaded",
        details: "Please select a resume file to upload",
      },
    });
  }

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        message: "Authentication required",
        details: "User information not found",
      },
    });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError,
  validateFileUpload,
  ALLOWED_EXT,
  MIME_FOR_EXT,
};
