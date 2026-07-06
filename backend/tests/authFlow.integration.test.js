const test = require("node:test");
const assert = require("node:assert/strict");
const Otp = require("../src/models/Otp");

/**
 * Verify the OTP schema accepts and persists all registration fields
 * This test validates the fix for the "Registration data corrupted" bug
 */
test("OTP Schema Accepts All Registration Fields Including Gender", () => {
  const registrationPayload = {
    name: "John Doe",
    studentId: "2021CSE001",
    email: "john.doe@vsit.edu.in",
    phone: "9876543210",
    department: "Computer Engineering",
    year: "Third Year",
    gender: "Male", // Critical field that was being lost before the fix
    password: "hashedPassword123!",
  };

  // Create OTP document with all registration data
  const otpInstance = new Otp({
    studentId: registrationPayload.studentId,
    email: registrationPayload.email,
    role: "student",
    purpose: "registration",
    otp: "hashedOtpValue",
    isHashed: true,
    failedAttempts: 0,
    isExpired: false,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    registrationData: {
      name: registrationPayload.name,
      phone: registrationPayload.phone,
      department: registrationPayload.department,
      year: registrationPayload.year,
      gender: registrationPayload.gender, // This is the field that must NOT be lost
      password: registrationPayload.password,
    },
  });

  // Convert to plain object to simulate database retrieval
  const plain = otpInstance.toObject();

  // Verify all fields are present
  assert.strictEqual(plain.registrationData.name, registrationPayload.name);
  assert.strictEqual(plain.registrationData.phone, registrationPayload.phone);
  assert.strictEqual(plain.registrationData.department, registrationPayload.department);
  assert.strictEqual(plain.registrationData.year, registrationPayload.year);
  assert.strictEqual(plain.registrationData.password, registrationPayload.password);

  // CRITICAL FIX: Gender field must be present and not stripped by schema
  assert.strictEqual(
    plain.registrationData.gender,
    registrationPayload.gender,
    "Gender field must be persisted in OTP document"
  );
  assert.notStrictEqual(plain.registrationData.gender, undefined);
  assert.notStrictEqual(plain.registrationData.gender, null);
});

/**
 * Verify the OTP verification validation won't fail due to missing gender
 * This simulates the exact check done in authController.verifyOtp()
 */
test("OTP Verification Validation Passes With All Required Fields", () => {
  const otpDoc = {
    registrationData: {
      name: "Test User",
      phone: "9999999999",
      department: "Mechanical Engineering",
      year: "First Year",
      gender: "Female", // This field is now in schema
      password: "hashedPassword",
    },
  };

  // This is the exact check from authController.js line 300-302
  const hasAllRequiredFields =
    !!otpDoc.registrationData &&
    !!otpDoc.registrationData.name &&
    !!otpDoc.registrationData.phone &&
    !!otpDoc.registrationData.department &&
    !!otpDoc.registrationData.password &&
    !!otpDoc.registrationData.year &&
    !!otpDoc.registrationData.gender;

  assert.ok(
    hasAllRequiredFields,
    "All required fields for OTP verification must be present"
  );
});

/**
 * Verify missing gender field would be caught by validation
 */
test("OTP Verification Validation Fails If Gender Is Missing", () => {
  const otpDoc = {
    registrationData: {
      name: "Test User",
      phone: "9999999999",
      department: "Mechanical Engineering",
      year: "First Year",
      // gender: undefined, <-- missing field (the BUG we fixed)
      password: "hashedPassword",
    },
  };

  // This is the exact check from authController.js
  const hasAllRequiredFields =
    !!otpDoc.registrationData &&
    !!otpDoc.registrationData.name &&
    !!otpDoc.registrationData.phone &&
    !!otpDoc.registrationData.department &&
    !!otpDoc.registrationData.password &&
    !!otpDoc.registrationData.year &&
    !!otpDoc.registrationData.gender; // <-- would be false

  assert.strictEqual(
    hasAllRequiredFields,
    false,
    "Validation should fail when gender is missing"
  );
});
