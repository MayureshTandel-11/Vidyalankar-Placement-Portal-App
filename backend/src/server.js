const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser"); // cookies parser
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const profileRoutes = require("./routes/profileRoutes");
const metadataRoutes = require("./routes/metadataRoutes");
const timelineRoutes = require("./routes/timeline");
const attendanceRoutes = require("./routes/attendance");
const notificationRoutes = require("./routes/notificationRoutes");
const offerLetterRoutes = require("./routes/offerLetterRoutes");
const resultRoutes = require("./routes/resultRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const { sanitizeRequest } = require("./middleware/sanitizeMiddleware");
const { seedAdminUser, DEFAULT_ADMIN } = require("./utils/seedAdmin");
const { setIO } = require("./utils/io");
const { globalLimiter } = require("./middleware/rateLimiter");
const { globalErrorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { validateEnv } = require("./utils/envCheck");


// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

// SECURITY: Validate environment variables on startup
validateEnv();

const app = express();


// SECURITY: Trust proxy if behind reverse proxy (e.g., nginx, AWS load balancer)
app.set("trust proxy", 1);

// SECURITY: Helmet for security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_ORIGIN || "http://localhost:5173"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: process.env.NODE_ENV === "production"
  },
  noSniff: true,
  xssFilter: true,
  frameGuard: {
    action: "deny"
  }
}));

// for parsing cookies
app.use(cookieParser());

// CORS configuration
const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV === "development" && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin))) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 3600 // Preflight cache for 1 hour
};

app.use(cors(corsOptions));

// Body parsing (large JSON for student profile photo base64 payloads)
app.use(express.json({ limit: "5mb" }));

// Serve uploaded resume files as static assets (for direct URL access)
// Files are stored at backend/uploads/resumes/ and accessible at /uploads/resumes/<filename>
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));



// SECURITY: Global rate limiting (100 requests per 15 minutes per IP)
app.use(globalLimiter);

// SECURITY: Request sanitization (handles MongoDB injection prevention)
app.use(sanitizeRequest);

// Development logging
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    const origin = req.headers.origin || "no-origin";
    console.log(`[REQ] ${req.method} ${req.originalUrl} origin=${origin}`);
    if (req.method === "OPTIONS") {
      res.on("finish", () => {
        console.log(
          `[CORS] OPTIONS ${req.originalUrl} -> ${res.statusCode} ACO=${res.getHeader("Access-Control-Allow-Origin")} ACM=${res.getHeader("Access-Control-Allow-Methods")} ACH=${res.getHeader("Access-Control-Allow-Headers")}`
        );
      });
    }
  }
  next();
});

// Health check endpoint (not rate limited)
app.get("/", (req, res) => {
  res.json({ message: "Placement Portal API running" });
});

// Route handlers
app.use("/api/auth", authRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student", profileRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/offerLetters", offerLetterRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/promotions", promotionRoutes);

// SECURITY: 404 handler (before error handler)
app.use(notFoundHandler);

// SECURITY: Global error handling middleware (must be last)
app.use(globalErrorHandler);

// Create HTTP server for Socket.IO integration
const server = http.createServer(app);

/**
 * Socket.IO JWT Authentication Middleware
 * SECURITY: Only allow authenticated connections with valid JWT
 * Verifies token and attaches userId to socket for use in handlers
 */
const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.error(`[SOCKET AUTH FAILURE] No token provided from ${socket.id}`);
    return next(new Error("Authentication token required"));
  }

  if (!process.env.JWT_SECRET) {
    console.error("[SOCKET AUTH ERROR] JWT_SECRET not configured");
    return next(new Error("Server configuration error"));
  }

  try {
    // Verify JWT with same secret used for token creation
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user information to socket for use in event handlers
    socket.userId = decoded.id;
    socket.userRole = decoded.role || "student"; // Default role if not in token
    socket.userEmail = decoded.email || "unknown";

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[SOCKET AUTH SUCCESS] User ${socket.userId} (${socket.userRole}) authenticated\n` +
        `  Socket ID: ${socket.id}\n` +
        `  Token expires: ${new Date(decoded.exp * 1000).toISOString()}`
      );
    } else {
      console.log(`[SOCKET AUTH SUCCESS] User ${socket.userId} connected: ${socket.id}`);
    }

    next();
  } catch (err) {
    const errorType = err.name; // 'TokenExpiredError', 'JsonWebTokenError', etc.

    if (errorType === "TokenExpiredError") {
      const expiredAt = new Date(err.expiredAt).toISOString();
      console.warn(
        `[SOCKET AUTH FAILURE] Token expired for ${socket.id}\n` +
        `  Expired at: ${expiredAt}`
      );
      return next(new Error("Token expired"));
    } else if (errorType === "JsonWebTokenError") {
      console.warn(`[SOCKET AUTH FAILURE] Invalid token for ${socket.id}: ${err.message}`);
      return next(new Error("Invalid token"));
    } else {
      console.warn(`[SOCKET AUTH FAILURE] Token verification error for ${socket.id}: ${err.message}`);
      return next(new Error("Token verification failed"));
    }
  }
};

// Initialize Socket.IO with CORS configuration and security settings
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV === "development" && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin))) {
        cb(null, true);
      } else {
        cb(new Error(`Socket CORS blocked: ${origin}`), false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    maxAge: 3600
  },
  transports: ["websocket"], // WebSocket only (more secure than polling)
  allowUpgrades: false, // Disable fallback to polling
  pingInterval: 25000,
  pingTimeout: 60000
});

// SECURITY: Apply JWT authentication middleware to all Socket.io connections
io.use(socketAuthMiddleware);

// Set io instance globally so routes can access it
setIO(io);

// Socket.IO connection error handler - fires before connection event if auth fails
io.on("connection_error", (error) => {
  console.error(
    `[SOCKET CONNECTION ERROR] Auth failed\n` +
    `  Error: ${error.message}\n` +
    `  Code: ${error.code}`
  );
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[SOCKET CONNECTED] User ${socket.userId} authenticated\n` +
      `  Socket ID: ${socket.id}\n` +
      `  Role: ${socket.userRole}\n` +
      `  Email: ${socket.userEmail}`
    );
  } else {
    console.log(`[SOCKET CONNECTED] User ${socket.userId}: ${socket.id}`);
  }

  socket.on("join:opportunity", ({ opportunityId }) => {
    if (!opportunityId) {
      console.warn(`[SOCKET EVENT] Invalid opportunityId from user ${socket.userId} (${socket.id})`);
      socket.emit("error", "Invalid opportunity ID");
      return;
    }
    const roomName = `opportunity_${opportunityId}`;
    socket.join(roomName);
    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET EVENT] User ${socket.userId} joined room ${roomName} (${socket.id})`);
    }
  });

  socket.on("leave:opportunity", ({ opportunityId }) => {
    if (!opportunityId) {
      console.warn(`[SOCKET EVENT] Invalid opportunityId from user ${socket.userId} (${socket.id})`);
      socket.emit("error", "Invalid opportunity ID");
      return;
    }
    const roomName = `opportunity_${opportunityId}`;
    socket.leave(roomName);
    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET EVENT] User ${socket.userId} left room ${roomName} (${socket.id})`);
    }
  });

  socket.on("error", (err) => {
    console.error(`[SOCKET ERROR] From user ${socket.userId} (${socket.id}): ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[SOCKET DISCONNECTED] User ${socket.userId}: ${socket.id}\n` +
      `  Reason: ${reason}`
    );
  });
});

// Export for use in route handlers
module.exports = { server, io, app };

const startServer = async () => {
  try {
    await connectDB();

    const adminSeedResult = await seedAdminUser();
    if (adminSeedResult.created) {
      console.log(
        `[ADMIN SEED] Admin created: email=${DEFAULT_ADMIN.email} password=${DEFAULT_ADMIN.password}`
      );
    } else {
      console.log(`[ADMIN SEED] Admin already present: email=${adminSeedResult.email}`);
    }

    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      console.log(`[SERVER] ✓ Running on port ${PORT} with Socket.IO`);
      console.log(`[SERVER] ✓ Environment: ${process.env.NODE_ENV}`);
      console.log(`[SERVER] ✓ Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.error("[SERVER] Failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
