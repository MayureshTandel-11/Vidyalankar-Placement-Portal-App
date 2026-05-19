const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Only PDF files for offer letters (strict)
const ALLOWED_EXT = new Set([".pdf"]);
const ALLOWED_MIME = "application/pdf";

// Configure storage for offer letters
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/offerLetters");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    // Ensure it's a PDF
    const safeExt = ALLOWED_EXT.has(ext) ? ext : ".pdf";
    // Create unique filename: studentId_opportunityId_timestamp_random.pdf
    const studentId = req.user?.studentId || req.user?._id || "user";
    const opportunityId = req.params?.opportunityId || "opportunity";
    const sanitized = `${studentId}_${opportunityId}`.replace(/[^\w-]/g, "_");
    cb(
      null,
      `${sanitized}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.pdf`
    );
  },
});

// File filter - only PDF files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";

  if (!ALLOWED_EXT.has(ext) || mime !== ALLOWED_MIME) {
    return cb(
      new Error("Only PDF files are allowed for offer letters")
    );
  }

  cb(null, true);
};

// Multer configuration with 5MB limit
const uploadOfferLetter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Error handler for offer letter uploads
const handleOfferLetterUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({
        success: false,
        message: "File size exceeds 5MB limit",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Only one file is allowed",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Upload failed",
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Upload failed",
    });
  }

  next();
};

module.exports = { uploadOfferLetter, handleOfferLetterUploadError };
