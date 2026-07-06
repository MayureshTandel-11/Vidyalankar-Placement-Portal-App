const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    studentId: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, enum: ["admin", "faculty", "student"] },
    purpose: { type: String, enum: ["registration", "password_reset"], default: "registration" },
    otp: { type: String, required: true }, // Hashed OTP (bcrypt or SHA-256)
    isHashed: { type: Boolean, default: true }, // Flag indicating if otp field is hashed
    expiresAt: { type: Date, required: true },

    // OTP verification attempt tracking
    failedAttempts: { type: Number, default: 0 }, // Number of failed verification attempts
    maxAttempts: { type: Number, default: 3 }, // Max failed attempts before expiring OTP
    isExpired: { type: Boolean, default: false }, // Flag to mark OTP as expired after max attempts

    // Registration data - stored temporarily until OTP verification
    registrationData: {
      name: { type: String },
      phone: { type: String },
      department: { type: String },
      password: { type: String }, // Hashed password
      year: { type: String }, // Year (1st Year, 2nd Year, 3rd Year, 4th Year)
      gender: { type: String }, // Gender (required for user creation)
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);
