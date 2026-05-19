const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  getResultStudents,
  uploadOfferLetter,
  downloadOfferLetter,
} = require("../controllers/resultController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Configure multer for offer letter uploads (PDF only)
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
    const safeExt = ext === ".pdf" ? ".pdf" : ".pdf";
    const studentId =
      (req.body.studentId && String(req.body.studentId).replace(/[^\w-]/g, "")) ||
      String(req.user?._id || "user");
    cb(
      null,
      `${studentId}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext !== ".pdf") {
    return cb(new Error("Only PDF files are allowed for offer letters"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File size exceeds 5MB limit",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next();
};

// Routes
// Get result students for an opportunity
router.get("/:opportunityId", protect, getResultStudents);

// Upload offer letter
router.post(
  "/upload-offer-letter",
  protect,
  allowRoles("admin", "faculty"),
  upload.single("offerLetter"),
  handleUploadError,
  uploadOfferLetter
);

// Download offer letter
router.get("/download/:offerId", protect, downloadOfferLetter);

module.exports = router;
