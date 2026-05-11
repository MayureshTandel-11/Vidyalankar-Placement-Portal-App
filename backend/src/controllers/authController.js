const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendOtpEmail } = require("../utils/sendOtpEmail");
const { sanitizeUserResponse, sanitizeString } = require("../utils/sanitize");
const { fail, ok } = require("../utils/apiResponse");
const { isValidDepartment } = require("../constants/departments");

// Constants
const BCRYPT_SALT_ROUNDS = 12; // Use 12 for better security
const ACCESS_TOKEN_EXPIRY = "30m";
const REFRESH_TOKEN_EXPIRY = "7d";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 3;

const instituteEmailRegex = /^[a-z]+(?:\.[a-z]+)+@vsit\.edu\.in$/i;

// In-memory OTP request limiter (in production, use Redis)
const otpRateWindowMs = 60 * 10000;
const otpRequestLimitPerWindow = 30;
const otpLimiter = new Map();

const canRequestOtp = (studentId) => {
  const now = Date.now();
  const current = otpLimiter.get(studentId) || { count: 0, resetAt: now + otpRateWindowMs };
  if (current.resetAt < now) {
    otpLimiter.set(studentId, { count: 1, resetAt: now + otpRateWindowMs });
    return true;
  }
  if (current.count >= otpRequestLimitPerWindow) return false;
  otpLimiter.set(studentId, { ...current, count: current.count + 1 });
  return true;
};

/**
 * Issue access token (15m expiry)
 * For use in Authorization: Bearer header
 */
const issueAccessToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY
  });
};

/**
 * Issue refresh token (7d expiry)
 * For use in httpOnly, sameSite=strict, secure cookie
 */
const issueRefreshToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY
  });
};

/**
 * Hash OTP using bcrypt
 * @param {string} plainOtp - Plain 6-digit OTP
 * @returns {Promise<string>} - Hashed OTP
 */
const hashOtp = async (plainOtp) => {
  return bcrypt.hash(plainOtp, BCRYPT_SALT_ROUNDS);
};

/**
 * Compare plain OTP with hashed OTP
 * @param {string} plainOtp - Plain 6-digit OTP from user
 * @param {string} hashedOtp - Hashed OTP from database
 * @returns {Promise<boolean>} - True if match, false otherwise
 */
const verifyOtpHash = async (plainOtp, hashedOtp) => {
  return bcrypt.compare(plainOtp, hashedOtp);
};

/**
 * Set refresh token cookie with secure settings
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Not accessible via JavaScript
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/", // Available to all routes
    signed: false // Not signed, JWT is self-validating
  });
};

/**
 * Clear refresh token cookie
 */
const clearRefreshTokenCookie = (res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
  });
};

/**
 * POST /api/auth/register
 * Register a new student and send OTP for verification
 */
const registerStudent = async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const studentId = sanitizeString(req.body.studentId);
    const department = sanitizeString(req.body.department);
    const email = sanitizeString(req.body.email);
    const phone = sanitizeString(req.body.phone);
    const year = sanitizeString(req.body.year);
    const password = sanitizeString(req.body.password);

    console.log(`[AUTH][REGISTER] Incoming registration payload for ${studentId}:`, {
      name: !!name,
      studentId: !!studentId,
      email: !!email,
      phone: !!phone,
      department: !!department,
      year: !!year,
      password: !!password,
    });

    if (!name || !studentId || !department || !email || !phone || !year || !password) {
      return fail(res, 400, "Name, student ID, email, department, year, phone and password are required");
    }
    if (!instituteEmailRegex.test(email)) {
      return fail(res, 400, "Email must follow name.surname@vsit.edu.in format");
    }
    if (!/^\d{10}$/.test(phone)) {
      return fail(res, 400, "Phone number must be exactly 10 digits");
    }
    if (!isValidDepartment(department)) {
      return fail(res, 400, "Invalid department");
    }
    const validYears = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    if (!validYears.includes(year)) {
      return fail(res, 400, "Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year");
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      return fail(res, 400, "Password must be 8+ chars with uppercase, number and special character");
    }
    // SECURITY: Reject if password equals email
    if (password === email) {
      return fail(res, 400, "Password must not equal email");
    }
    if (!canRequestOtp(studentId)) {
      return res.status(429).json({ message: "Too many OTP requests. Try again in a minute." });
    }

    // Check if student already registered and verified
    const existing = await User.findOne({ studentId });
    if (existing) {
      return fail(res, 400, "Student already registered");
    }

    // Hash password for storage in OTP document
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate plain OTP
    const plainOtp = `${crypto.randomInt(100000, 1000000)}`;

    // Hash OTP before storing
    const hashedOtp = await hashOtp(plainOtp);

    // Store OTP with registration data (user NOT created in DB yet)
    const otpDoc = await Otp.findOneAndUpdate(
      { studentId, purpose: "registration" },
      {
        studentId,
        email,
        role: "student",
        purpose: "registration",
        otp: hashedOtp,
        isHashed: true,
        failedAttempts: 0,
        isExpired: false,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        registrationData: {
          name,
          phone,
          department,
          year,
          password: hashedPassword,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    // Ensure OTP was created before proceeding
    if (!otpDoc) {
      console.error(`[AUTH][REGISTER] Failed to create OTP document for ${studentId}`);
      return fail(res, 500, "Failed to create OTP. Please try again.");
    }

    let otpDelivery = "sent";
    let otpDeliveryError = "";
    if (email) {
      try {
        // Send plaintext OTP to user's email
        await sendOtpEmail(email, plainOtp);
      } catch (mailError) {
        otpDelivery = "failed";
        otpDeliveryError = mailError.message;
        console.warn(`[AUTH][REGISTER] Email delivery failed for ${studentId}:`, mailError.message);
      }
    }

    console.log(`[AUTH][REGISTER] ✓ Registration initiated for ${studentId} (${email}). OTP created (not verified yet). Delivery: ${otpDelivery}`);

    return ok(
      res,
      {
        message: otpDelivery === "sent" ? "OTP sent successfully. Check your email." : "OTP generated, but email delivery failed. Please try again.",
        otpDelivery,
        ...(otpDeliveryError ? { otpDeliveryError } : {}),
      },
      201
    );
  } catch (error) {
    console.error(`[AUTH][REGISTER][ERROR]`, error.message);
    return fail(res, 500, "Registration failed", error.message);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP and create user account
 */
const verifyOtp = async (req, res) => {
  try {
    const studentId = sanitizeString(req.body.studentId);
    const plainOtp = sanitizeString(req.body.otp);

    console.log(`[AUTH][VERIFY_OTP] Verifying OTP for studentId: ${studentId}`);

    const otpDoc = await Otp.findOne({ studentId, purpose: "registration" });
    if (!otpDoc) {
      console.log(`[AUTH][VERIFY_OTP] No OTP document found for studentId: ${studentId}`);
      return fail(res, 400, "Registration not found. Please register first.");
    }

    // SECURITY: Check if OTP is expired
    if (otpDoc.expiresAt < new Date()) {
      console.log(`[AUTH][VERIFY_OTP] OTP expired for studentId: ${studentId}`);
      return fail(res, 400, "OTP has expired. Please request a new one.");
    }

    // SECURITY: Check if OTP was manually expired due to max attempts
    if (otpDoc.isExpired) {
      console.log(`[AUTH][VERIFY_OTP] OTP manually expired (max attempts) for studentId: ${studentId}`);
      return fail(res, 400, "Too many failed attempts. Please request a new OTP.");
    }

    // SECURITY: Verify OTP hash
    const isOtpValid = await verifyOtpHash(plainOtp, otpDoc.otp);
    if (!isOtpValid) {
      // Increment failed attempts
      otpDoc.failedAttempts += 1;

      // If max attempts reached, expire the OTP
      if (otpDoc.failedAttempts >= MAX_OTP_ATTEMPTS) {
        otpDoc.isExpired = true;
        await otpDoc.save();
        console.log(`[AUTH][VERIFY_OTP] OTP expired after ${MAX_OTP_ATTEMPTS} failed attempts for studentId: ${studentId}`);
        return fail(res, 400, `Too many failed attempts (${otpDoc.failedAttempts}/${MAX_OTP_ATTEMPTS}). Request a new OTP.`);
      }

      // Save updated attempt count
      await otpDoc.save();
      console.log(`[AUTH][VERIFY_OTP] OTP mismatch for studentId: ${studentId} (attempt ${otpDoc.failedAttempts}/${MAX_OTP_ATTEMPTS})`);
      return fail(res, 400, `Invalid OTP. Attempt ${otpDoc.failedAttempts}/${MAX_OTP_ATTEMPTS}`);
    }

    const registrationData = otpDoc.registrationData;
    if (!registrationData || !registrationData.name || !registrationData.phone || !registrationData.department || !registrationData.password || !registrationData.year) {
      console.error(`[AUTH][VERIFY_OTP] Missing registration data for studentId: ${studentId}`, {
        name: !!registrationData?.name,
        phone: !!registrationData?.phone,
        department: !!registrationData?.department,
        password: !!registrationData?.password,
        year: !!registrationData?.year,
      });
      return fail(res, 500, "Registration data corrupted. Please register again.");
    }

    console.log(`[AUTH][CREATE_USER] Creating user with data for ${studentId}:`, {
      name: registrationData.name,
      studentId,
      department: registrationData.department,
      year: registrationData.year,
      phone: registrationData.phone,
    });

    // Create user with isVerified: true
    const user = await User.create({
      name: registrationData.name,
      studentId,
      department: registrationData.department,
      role: "student",
      email: otpDoc.email,
      phone: registrationData.phone,
      year: registrationData.year,
      password: registrationData.password,
      isVerified: true,
    });

    console.log(`[AUTH][VERIFY_OTP] ✓ User created successfully for studentId: ${studentId}, userId: ${user._id}`);

    // Delete OTP document after successful verification
    await Otp.deleteOne({ _id: otpDoc._id });

    // Issue tokens
    const accessToken = issueAccessToken(user._id);
    const refreshToken = issueRefreshToken(user._id);

    // Set refresh token in secure httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    return ok(res, {
      accessToken,
      user: sanitizeUserResponse(user)
    });
  } catch (error) {
    console.error(`[AUTH][VERIFY_OTP][ERROR]`, error.message);
    return fail(res, 500, "OTP verification failed", error.message);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and issue tokens
 */
const login = async (req, res) => {
  try {
    // === Step 1: Log request ===
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH] \n========== /login Request ==========");
      console.log("[AUTH] Request body keys:", Object.keys(req.body || {}));
      console.log("[AUTH] Raw request body:", JSON.stringify(req.body, null, 2));
      console.log("[AUTH] Authorization header:", req.headers.authorization ? "PRESENT" : "MISSING");
    }

    // === Step 2: Validate request has required fields ===
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn("[AUTH] Request body is empty or missing");
      return fail(res, 400, "Request body is required");
    }

    // === Step 3: Sanitize and validate inputs ===
    let email, password, studentId, role;
    try {
      email = sanitizeString(req.body.email);
      password = sanitizeString(req.body.password);
      studentId = sanitizeString(req.body.studentId);
      role = sanitizeString(req.body.role);

      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Sanitized values:");
        console.log("  - role:", role || "EMPTY");
        console.log("  - email:", email ? `${email.substring(0, 5)}...` : "EMPTY");
        console.log("  - studentId:", studentId || "EMPTY");
        console.log("  - password:", password ? "***PRESENT***" : "EMPTY");
      }
    } catch (err) {
      console.error("[AUTH] ❌ Sanitization error:", err.message);
      return fail(res, 400, "Invalid input format", err.message);
    }

    // === Step 4: Validate role ===
    if (!role || !["student", "admin", "faculty"].includes(role)) {
      console.warn("[AUTH] ❌ Invalid or missing role:", role);
      return fail(res, 400, "Valid role (student/admin/faculty) is required");
    }

    // === Step 5: Validate password ===
    if (!password || password.trim().length === 0) {
      console.warn("[AUTH] ❌ Empty or missing password");
      return fail(res, 400, "Password is required");
    }

    // ========== STUDENT LOGIN ==========
    if (role === "student") {
      console.log("[AUTH] Attempting student login...");

      const identifier = studentId || email;
      if (!identifier || identifier.trim().length === 0) {
        console.warn("[AUTH] ❌ No student ID or email provided");
        return fail(res, 400, "Student ID or email is required");
      }

      // Build query
      const query = { role: "student" };
      if (instituteEmailRegex.test(identifier)) {
        query.email = identifier;
        console.log("[AUTH] Searching by email:", identifier);
      } else {
        query.studentId = identifier;
        console.log("[AUTH] Searching by studentId:", identifier);
      }

      // Query database
      let student;
      try {
        student = await User.findOne(query);
        if (process.env.NODE_ENV === "development") {
          console.log("[AUTH] Database query result:");
          console.log("  - Found:", Boolean(student));
          if (student) {
            console.log("  - Verified:", Boolean(student.isVerified));
            console.log("  - Role:", student.role);
            console.log("  - Has password hash:", Boolean(student.password));
          }
        }
      } catch (err) {
        console.error("[AUTH] ❌ Database query error:", err.message);
        return fail(res, 500, "Database error", err.message);
      }

      // Check if student exists
      if (!student) {
        console.warn("[AUTH] ❌ Student not found for identifier:", identifier);
        return fail(res, 401, "Invalid credentials");
      }

      // Check if student is verified
      if (!student.isVerified) {
        console.warn("[AUTH] ❌ Student not verified for studentId:", student.studentId);
        return fail(res, 401, "Account not verified. Please verify your email.");
      }

      // Verify password
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, student.password);
        if (process.env.NODE_ENV === "development") {
          console.log("[AUTH] Password validation:", isPasswordValid ? "✓ MATCH" : "✗ MISMATCH");
        }
      } catch (bcryptErr) {
        console.error("[AUTH] ❌ Password comparison error:", bcryptErr.message);
        return fail(res, 500, "Authentication error", bcryptErr.message);
      }

      if (!isPasswordValid) {
        console.warn("[AUTH] ❌ Invalid password for student:", student.studentId);
        return fail(res, 401, "Invalid credentials");
      }

      // Generate tokens
      let accessToken, refreshToken;
      try {
        accessToken = issueAccessToken(student._id);
        refreshToken = issueRefreshToken(student._id);
        setRefreshTokenCookie(res, refreshToken);
        console.log("[AUTH] ✓ Tokens issued for student:", student.studentId);
      } catch (tokenErr) {
        console.error("[AUTH] ❌ Token generation error:", tokenErr.message);
        return fail(res, 500, "Token generation failed", tokenErr.message);
      }

      // Success
      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] ✓ Student login successful:", student.studentId);
        console.log("[AUTH] ========== End /login ==========\n");
      }

      return ok(res, {
        accessToken,
        user: sanitizeUserResponse(student)
      });
    }

    // ========== ADMIN/FACULTY LOGIN ==========
    console.log("[AUTH] Attempting admin/faculty login...");

    if (!email || email.trim().length === 0) {
      console.warn("[AUTH] ❌ Email is required for admin/faculty login");
      return fail(res, 400, "Email is required");
    }

    // Query database
    let user;
    try {
      user = await User.findOne({ email, role });
      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Database query result:");
        console.log("  - Found:", Boolean(user));
        if (user) {
          console.log("  - Role:", user.role);
          console.log("  - Has password hash:", Boolean(user.password));
        }
      }
    } catch (err) {
      console.error("[AUTH] ❌ Database query error:", err.message);
      return fail(res, 500, "Database error", err.message);
    }

    if (!user) {
      console.warn("[AUTH] ❌ User not found for email:", email);
      return fail(res, 401, "Invalid credentials");
    }

    if (!["admin", "faculty"].includes(user.role)) {
      console.warn("[AUTH] ❌ Invalid role:", user.role);
      return fail(res, 401, "Invalid credentials");
    }

    // Verify password
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
      if (process.env.NODE_ENV === "development") {
        console.log("[AUTH] Password validation:", isMatch ? "✓ MATCH" : "✗ MISMATCH");
      }
    } catch (bcryptErr) {
      console.error("[AUTH] ❌ Password comparison error:", bcryptErr.message);
      return fail(res, 500, "Authentication error", bcryptErr.message);
    }

    if (!isMatch) {
      console.warn("[AUTH] ❌ Invalid password for user:", email);
      return fail(res, 401, "Invalid credentials");
    }

    // Generate tokens
    let accessToken, refreshToken;
    try {
      accessToken = issueAccessToken(user._id);
      refreshToken = issueRefreshToken(user._id);
      setRefreshTokenCookie(res, refreshToken);
      console.log("[AUTH] ✓ Tokens issued for", user.role + ":", email);
    } catch (tokenErr) {
      console.error("[AUTH] ❌ Token generation error:", tokenErr.message);
      return fail(res, 500, "Token generation failed", tokenErr.message);
    }

    // Success
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH] ✓", user.role, "login successful:", email);
      console.log("[AUTH] ========== End /login ==========\n");
    }

    return ok(res, {
      accessToken,
      user: sanitizeUserResponse(user)
    });
  } catch (error) {
    console.error("[AUTH] ❌ OUTER CATCH - Login error:", error.message);
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Stack trace:", error.stack);
    }
    return fail(res, 500, "Login failed", error.message);
  }
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
const refreshAccessToken = async (req, res) => {
  try {
    // req.user is set by verifyRefreshToken middleware
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      clearRefreshTokenCookie(res);
      return fail(res, 401, "User not found");
    }

    // Verify student is still verified
    if (user.role === "student" && !user.isVerified) {
      clearRefreshTokenCookie(res);
      return fail(res, 401, "Account no longer verified");
    }

    // Issue new access token
    const accessToken = issueAccessToken(user._id);

    console.log(`[AUTH] ✓ Access token refreshed for user: ${user.email}`);

    return ok(res, {
      accessToken,
      user: sanitizeUserResponse(user)
    });
  } catch (error) {
    console.error(`[AUTH] Refresh token error: ${error.message}`);
    clearRefreshTokenCookie(res);
    return fail(res, 500, "Token refresh failed");
  }
};

/**
 * POST /api/auth/logout
 * Clear refresh token cookie and log out user
 */
const logout = async (req, res) => {
  try {
    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    console.log(`[AUTH] ✓ User logged out: ${req.user?.email || "unknown"}`);

    return ok(res, {
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error(`[AUTH] Logout error: ${error.message}`);
    return fail(res, 500, "Logout failed");
  }
};

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
const changePassword = async (req, res) => {
  try {
    const currentPassword = sanitizeString(req.body.currentPassword);
    const newPassword = sanitizeString(req.body.newPassword);
    const confirmNewPassword = sanitizeString(req.body.confirmNewPassword);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return fail(res, 400, "All password fields are required");
    }
    if (newPassword !== confirmNewPassword) return fail(res, 400, "New passwords do not match");
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      return fail(res, 400, "Password must be 8+ chars with uppercase, number and special character");
    }

    // SECURITY: Reject if new password equals email
    const user = await User.findById(req.user._id);
    if (newPassword === user.email) {
      return fail(res, 400, "Password must not equal email");
    }

    if (!user || !user.password) return fail(res, 400, "Password change is unavailable for this account");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return fail(res, 401, "Current password is incorrect");

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();

    return ok(res, { message: "Password changed successfully" });
  } catch (error) {
    return fail(res, 500, "Failed to change password", error.message);
  }
};

/**
 * POST /api/auth/forgot-password/request-otp
 * Request OTP for password reset
 */
const requestPasswordResetOtp = async (req, res) => {
  try {
    const email = sanitizeString(req.body.email);
    const role = sanitizeString(req.body.role);

    if (!email || !role) return fail(res, 400, "Email and role are required");
    if (!instituteEmailRegex.test(email)) return fail(res, 400, "Invalid institute email format");

    const user = await User.findOne({ email, role });
    if (!user) return fail(res, 404, "Account not found");

    // Generate plain OTP
    const plainOtp = `${crypto.randomInt(100000, 1000000)}`;

    // Hash OTP before storing
    const hashedOtp = await hashOtp(plainOtp);

    await Otp.findOneAndUpdate(
      { email, role, purpose: "password_reset" },
      {
        email,
        role,
        purpose: "password_reset",
        otp: hashedOtp,
        isHashed: true,
        failedAttempts: 0,
        isExpired: false,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS)
      },
      { upsert: true }
    );

    // Send plaintext OTP to user's email
    await sendOtpEmail(email, plainOtp);

    return ok(res, { message: "Reset OTP sent successfully" });
  } catch (error) {
    return fail(res, 500, "Failed to send reset OTP", error.message);
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Reset password with OTP verification
 */
const resetPasswordWithOtp = async (req, res) => {
  try {
    const email = sanitizeString(req.body.email);
    const role = sanitizeString(req.body.role);
    const plainOtp = sanitizeString(req.body.otp);
    const newPassword = sanitizeString(req.body.newPassword);
    const confirmNewPassword = sanitizeString(req.body.confirmNewPassword);

    if (!email || !role || !plainOtp || !newPassword || !confirmNewPassword) {
      return fail(res, 400, "All fields are required");
    }
    if (newPassword !== confirmNewPassword) return fail(res, 400, "New passwords do not match");
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      return fail(res, 400, "Password must be 8+ chars with uppercase, number and special character");
    }
    // SECURITY: Reject if new password equals email
    if (newPassword === email) {
      return fail(res, 400, "Password must not equal email");
    }

    const otpDoc = await Otp.findOne({ email, role, purpose: "password_reset" });
    if (!otpDoc) {
      return fail(res, 400, "OTP not found. Request a new one.");
    }

    // SECURITY: Check OTP expiry
    if (otpDoc.expiresAt < new Date()) {
      return fail(res, 400, "OTP has expired. Request a new one.");
    }

    // SECURITY: Check if OTP was manually expired due to max attempts
    if (otpDoc.isExpired) {
      return fail(res, 400, "Too many failed attempts. Request a new OTP.");
    }

    // SECURITY: Verify OTP hash
    const isOtpValid = await verifyOtpHash(plainOtp, otpDoc.otp);
    if (!isOtpValid) {
      // Increment failed attempts
      otpDoc.failedAttempts += 1;

      if (otpDoc.failedAttempts >= MAX_OTP_ATTEMPTS) {
        otpDoc.isExpired = true;
        await otpDoc.save();
        return fail(res, 400, `Too many failed attempts (${otpDoc.failedAttempts}/${MAX_OTP_ATTEMPTS}). Request a new OTP.`);
      }

      await otpDoc.save();
      return fail(res, 400, `Invalid OTP. Attempt ${otpDoc.failedAttempts}/${MAX_OTP_ATTEMPTS}`);
    }

    // OTP verified - reset password
    const user = await User.findOne({ email, role });
    if (!user) return fail(res, 404, "Account not found");

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();

    await Otp.deleteOne({ _id: otpDoc._id });

    console.log(`[AUTH] ✓ Password reset successful for user: ${email}`);
    return ok(res, { message: "Password reset successful" });
  } catch (error) {
    return fail(res, 500, "Failed to reset password", error.message);
  }
};

module.exports = {
  registerStudent,
  verifyOtp,
  login,
  refreshAccessToken,
  logout,
  changePassword,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
};
