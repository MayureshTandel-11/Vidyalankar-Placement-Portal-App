const { body, validationResult } = require("express-validator");

/**
 * Standard validation error handler
 * Returns 400 with array of all validation errors
 * Never exposes stack traces
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg
    }));
    console.warn(`[VALIDATION] Validation failed for ${req.method} ${req.originalUrl}:`, errorMessages);
    return res.status(400).json({
      message: "Validation failed",
      errors: errorMessages
    });
  }
  next();
};

/**
 * Validation chain for user registration
 * Validates: email format, password strength, name, department, phone
 */
const validateRegister = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),

  body("email")
    .trim()
    .toLowerCase()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),

  body("studentId")
    .trim()
    .notEmpty().withMessage("Student ID is required"),

  body("department")
    .trim()
    .notEmpty().withMessage("Department is required"),

  body("phone")
    .trim()
    .matches(/^\d{10}$/).withMessage("Phone must be exactly 10 digits"),

  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/).withMessage("Password must contain at least one special character (!@#$%^&*)")
    .custom((value, { req }) => {
      // Reject if password equals email
      if (value === req.body.email) {
        throw new Error("Password must not equal email");
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation chain for user login
 * Validates: email/studentId format, password non-empty
 */
const validateLogin = [
  body("email").optional().trim().toLowerCase().isEmail().withMessage("Invalid email format"),
  body("studentId").optional().trim().notEmpty().withMessage("Student ID required if provided"),
  body("password")
    .trim()
    .notEmpty().withMessage("Password is required"),
  body("role")
    .trim()
    .isIn(["student", "admin", "faculty"]).withMessage("Invalid role"),

  handleValidationErrors
];

/**
 * Validation chain for OTP verification
 * Validates: OTP is 6-digit numeric string, studentId provided
 */
const validateVerifyOtp = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required"),

  body("otp")
    .trim()
    .matches(/^\d{6}$/).withMessage("OTP must be exactly 6 digits"),

  handleValidationErrors
];

/**
 * Validation chain for password change
 * Validates: current password, new password (8+ chars, 1 uppercase, 1 number, 1 special char)
 * Ensure new password is different from current
 */
const validateChangePassword = [
  body("currentPassword")
    .trim()
    .notEmpty().withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 }).withMessage("New password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/).withMessage("Password must contain at least one special character (!@#$%^&*)")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  body("confirmNewPassword")
    .trim()
    .notEmpty().withMessage("Confirm new password is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation chain for forgot password OTP request
 * Validates: email or studentId format
 */
const validateForgotPasswordRequest = [
  body("role")
    .trim()
    .notEmpty().withMessage("Role is required")
    .isIn(["student", "admin", "faculty"]).withMessage("Invalid role"),

  body("email").optional().trim().toLowerCase().isEmail().withMessage("Invalid email format"),
  body("studentId").optional().trim(),

  // Ensure at least one of email or studentId is provided
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.studentId) {
      throw new Error("Email or Student ID is required");
    }
    return true;
  }),

  handleValidationErrors
];

/**
 * Validation chain for password reset with OTP
 * Validates: OTP is 6-digit, new password meets requirements
 */
const validatePasswordReset = [
  body("role")
    .trim()
    .notEmpty().withMessage("Role is required")
    .isIn(["student", "admin", "faculty"]).withMessage("Invalid role"),

  body("email")
    .optional()
    .trim()
    .isEmail().withMessage("Invalid email format"),

  body("studentId")
    .optional()
    .trim(),

  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.studentId) {
      throw new Error("Email or Student ID is required");
    }
    return true;
  }),

  body("otp")
    .trim()
    .matches(/^\d{6}$/).withMessage("OTP must be exactly 6 digits"),

  body("newPassword")
    .isLength({ min: 8 }).withMessage("New password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/).withMessage("Password must contain at least one special character (!@#$%^&*)")
    .custom((value, { req }) => {
      if (req.body.email && value === req.body.email) {
        throw new Error("Password must not equal Email");
      }
      return true;
    }),

  body("confirmNewPassword")
    .trim()
    .notEmpty().withMessage("Confirm new password is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateVerifyOtp,
  validateChangePassword,
  validateForgotPasswordRequest,
  validatePasswordReset,
  handleValidationErrors
};
