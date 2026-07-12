const bcrypt = require("bcryptjs");
const User = require("../models/User");

const DEFAULT_ADMIN_EMAIL = "admin.vsit@vsit.edu.in";
const DEFAULT_ADMIN_NAME = "Portal Admin";

/**
 * Resolve bootstrap admin password.
 * - Prefer ADMIN_DEFAULT_PASSWORD from env
 * - In non-production only, fall back to a known local default
 * - In production with no env password, skip seeding (never hardcode prod secrets)
 */
const resolveBootstrapPassword = () => {
  const fromEnv = process.env.ADMIN_DEFAULT_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  return "Admin@123";
};

const DEFAULT_ADMIN = {
  name: DEFAULT_ADMIN_NAME,
  email: DEFAULT_ADMIN_EMAIL,
  role: "admin",
};

const seedAdminUser = async () => {
  const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL, role: "admin" });
  if (existingAdmin) {
    return { created: false, skipped: false, email: existingAdmin.email };
  }

  const password = resolveBootstrapPassword();
  if (!password) {
    return {
      created: false,
      skipped: true,
      email: DEFAULT_ADMIN_EMAIL,
      reason: "Set ADMIN_DEFAULT_PASSWORD to bootstrap the first admin in production",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name: DEFAULT_ADMIN_NAME,
    email: DEFAULT_ADMIN_EMAIL,
    role: "admin",
    password: hashedPassword,
    isVerified: true,
  });

  return { created: true, skipped: false, email: DEFAULT_ADMIN_EMAIL };
};

module.exports = { seedAdminUser, DEFAULT_ADMIN };
