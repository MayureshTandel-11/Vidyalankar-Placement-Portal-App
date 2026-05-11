const rateLimit = require("express-rate-limit");

/**
 * Global rate limiter: 300 requests per 15 minutes per IP
 * Applied to all routes for general DoS protection
 * Higher limit for normal dashboard usage
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests - enough for normal dashboard usage
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a reverse proxy, else use ip
    const key = req.ip || req.connection.remoteAddress;
    return key;
  },
  handler: (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    console.warn(
      `[RATE-LIMIT] Global limiter exceeded for IP: ${clientIp}`,
      `Path: ${req.path}, Method: ${req.method}`
    );
    res.status(429).json({
      message: "Too many requests, please try again later",
      retryAfter: req.rateLimit.resetTime,
      limit: req.rateLimit.limit,
      current: req.rateLimit.current
    });
  },
  skip: (req) => {
    // Don't rate limit health check or root endpoint
    return req.path === "/" || req.path === "/health";
  }
});

/**
 * Strict limiter for authentication routes
 * 50 requests per 15 minutes per IP
 * Applied to: /api/auth/register, /api/auth/login, /api/auth/verify-otp, /api/auth/refresh
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: "Too many authentication attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(
      `[RATE-LIMIT] Auth limiter exceeded for IP: ${req.ip}, route: ${req.path}`
    );
    res.status(429).json({
      message: "Too many authentication attempts, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Strict limiter for OTP endpoints
 * 10 requests per 15 minutes per IP
 * Applied to: /api/auth/forgot-password/request-otp, OTP verification attempts
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests
  message: "Too many OTP requests, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(
      `[RATE-LIMIT] OTP limiter exceeded for IP: ${req.ip}, route: ${req.path}`
    );
    res.status(429).json({
      message: "Too many OTP requests, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Moderate limiter for file uploads
 * 50 requests per 1 hour per IP
 * Applied to: /api/student/profile/upload-resume, etc.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests
  message: "Too many upload requests, please try again after 1 hour",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(
      `[RATE-LIMIT] Upload limiter exceeded for IP: ${req.ip}`
    );
    res.status(429).json({
      message: "Too many upload requests, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter
};
