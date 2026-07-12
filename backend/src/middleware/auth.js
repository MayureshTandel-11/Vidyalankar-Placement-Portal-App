const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Verify JWT access token from Authorization header
 * Used for protecting routes that require authentication
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    console.warn(`[AUTH] Missing or invalid Authorization header for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      message: "Unauthorized - Missing or invalid Authorization header",
      requiresLogin: true
    });
  }

  try {
    const token = header.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET not configured!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // If token is expired, return 401 with flag for frontend to call refresh
      if (jwtError.name === "TokenExpiredError") {
        console.warn(`[AUTH] JWT expired for ${req.method} ${req.originalUrl}`);
        return res.status(401).json({
          message: "Access token expired",
          tokenExpired: true
        });
      }
      console.warn(`[AUTH] JWT verification failed for ${req.method} ${req.originalUrl}: ${jwtError.message}`);
      return res.status(401).json({
        message: "Invalid or expired token",
        tokenExpired: jwtError.name === "TokenExpiredError"
      });
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      console.warn(`[AUTH] User not found for ID: ${decoded.id}`);
      return res.status(401).json({ message: "User not found - invalid token" });
    }

    // Enforce OTP verification for students before allowing access to protected routes
    if (user.role === "student" && !user.isVerified) {
      console.warn(`[AUTH] Unverified student attempted access: ${user.email} (${user._id})`);
      return res.status(401).json({
        message: "Student account not verified. Please verify your email/OTP.",
        requiresVerification: true,
        email: user.email
      });
    }

    // Check if student has required department field for filtration
    if (user.role === "student" && !user.department) {
      console.warn(`[AUTH] Student missing department field: ${user.email} (${user._id})`);
      return res.status(401).json({
        message: "Student profile incomplete - department not set",
        incompleteProfile: true
      });
    }

    console.log(`[AUTH ✓] ${user.role.toUpperCase()} authenticated: ${user.email} (${user._id})`);
    req.user = user;
    return next();
  } catch (error) {
    console.error(`[AUTH] Unexpected error during authentication: ${error.message}`);
    return res.status(401).json({ message: "Authentication failed" });
  }
};

/**
 * Verify refresh token from httpOnly cookie
 * Used for /api/auth/refresh endpoint to issue new access token
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      console.warn(`[AUTH] Missing refresh token cookie for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        message: "Refresh token missing or expired",
        requiresLogin: true
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET not configured!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.warn(`[AUTH] Refresh token verification failed: ${jwtError.message}`);
      // Clear invalid refresh token
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        requiresLogin: true
      });
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      console.warn(`[AUTH] User not found for refresh token ID: ${decoded.id}`);
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
      return res.status(401).json({
        message: "User not found",
        requiresLogin: true
      });
    }

    console.log(`[AUTH ✓] Refresh token valid for user: ${user.email} (${user._id})`);
    req.user = user;
    return next();
  } catch (error) {
    console.error(
      `[AUTH] Unexpected error during refresh token verification: ${error.message}`,
      process.env.NODE_ENV === "development" ? error.stack : ""
    );
    return res.status(401).json({
      message: "Token refresh failed",
      requiresLogin: true,
    });
  }
};

module.exports = { protect, verifyRefreshToken };
