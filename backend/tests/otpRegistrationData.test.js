const test = require("node:test");
const assert = require("node:assert/strict");
const Otp = require("../src/models/Otp");

test("OTP registration data preserves gender for verification", () => {
  const otpDoc = new Otp({
    studentId: "123456",
    email: "name.surname@vsit.edu.in",
    purpose: "registration",
    otp: "hashedOtp",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    registrationData: {
      name: "Test Student",
      phone: "9876543210",
      department: "Computer Engineering",
      year: "Second Year",
      gender: "Male",
      password: "hashedPassword",
    },
  });

  const plain = otpDoc.toObject();

  assert.equal(plain.registrationData.gender, "Male");
  assert.equal(plain.email, "name.surname@vsit.edu.in");
});
