const express = require("express");
const {
  login,
  registerStudent,
  verifyOtp,
  refreshAccessToken,
  logout,
  changePassword,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} = require("../controllers/authController");
const { protect, verifyRefreshToken } = require("../middleware/auth");
const { authLimiter, otpLimiter } = require("../middleware/rateLimiter");
const {
  validateRegister,
  validateLogin,
  validateVerifyOtp,
  validateChangePassword,
  validateForgotPasswordRequest,
  validatePasswordReset
} = require("../middleware/validate");

const router = express.Router();

// Registration routes
router.post("/register", authLimiter, validateRegister, registerStudent);
router.post("/verify-otp", otpLimiter, validateVerifyOtp, verifyOtp);

// Login route
router.post("/login", authLimiter, validateLogin, login);

// Refresh token route (get new access token)
router.post("/refresh", verifyRefreshToken, refreshAccessToken);

// Logout route (clear refresh token cookie; cookie-only — works even if access token expired)
router.post("/logout", logout);

// Password management routes
router.post("/change-password", protect, validateChangePassword, changePassword);
router.post("/forgot-password/request-otp", otpLimiter, validateForgotPasswordRequest, requestPasswordResetOtp);
router.post("/forgot-password/reset", otpLimiter, validatePasswordReset, resetPasswordWithOtp);

module.exports = router;
