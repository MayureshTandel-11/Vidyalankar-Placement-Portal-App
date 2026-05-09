const rateLimit = require("express-rate-limit");

/**
 * Global rate limiter: 100 requests per 15 minutes per IP
 * Applied to all routes for general DoS protection
 */
const globalLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a reverse proxy, else use ip
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(`[RATE-LIMIT] Global limiter exceeded for IP: ${req.ip}`);
    res.status(429).json({
      message: "Too many requests, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  },
  skip: (req) => {
    // Don't rate limit health check or root endpoint
    return req.path === "/" || req.path === "/health";
  }
});

/**
 * Strict limiter for authentication routes
 * 10 requests per 15 minutes per IP
 * Applied to: /api/auth/register, /api/auth/login, /api/auth/verify-otp, /api/auth/refresh
 */
const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 15 minutes
  max: 50, // 10 requests
  message: "Too many authentication attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(`[RATE-LIMIT] Auth limiter exceeded for IP: ${req.ip}, route: ${req.path}`);
    res.status(429).json({
      message: "Too many authentication attempts, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Strict limiter for OTP endpoints
 * 5 requests per 15 minutes per IP
 * Applied to: /api/auth/forgot-password/request-otp, OTP verification attempts
 */
const otpLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests
  message: "Too many OTP requests, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(`[RATE-LIMIT] OTP limiter exceeded for IP: ${req.ip}, route: ${req.path}`);
    res.status(429).json({
      message: "Too many OTP requests, please try again later",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Strict limiter for file uploads
 * 20 requests per 1 hour per IP
 * Applied to: /api/student/profile/upload-resume, etc.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 20 requests
  message: "Too many upload requests, please try again after 1 hour",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(`[RATE-LIMIT] Upload limiter exceeded for IP: ${req.ip}`);
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
