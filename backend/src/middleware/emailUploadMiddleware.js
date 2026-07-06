const multer = require("multer");

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 10;

const emailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

const handleEmailUploadError = (err, req, res, next) => {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "One or more attachments exceed the 25MB size limit",
    });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: `Maximum ${MAX_FILES} attachments allowed`,
    });
  }
  return res.status(400).json({
    success: false,
    message: err.message || "Failed to upload attachments",
  });
};

module.exports = { emailUpload, handleEmailUploadError };
