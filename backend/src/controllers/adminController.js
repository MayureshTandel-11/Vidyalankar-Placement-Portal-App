const bcrypt = require("bcryptjs");
const User = require("../models/User");
const DeletionRequest = require("../models/DeletionRequest");
const { sanitizeString, sanitizeUserResponse } = require("../utils/sanitize");
const { ok, fail } = require("../utils/apiResponse");
const { isValidDepartment } = require("../constants/departments");
const instituteEmailRegex = /^[a-z]+(?:\.[a-z]+)+@vsit\.edu\.in$/i;

const createFaculty = async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const email = sanitizeString(req.body.email);
    const password = sanitizeString(req.body.password);
    const department = sanitizeString(req.body.department);
    if (!name || !email || !password || !department) {
      return fail(res, 400, "All fields are required");
    }
    if (!instituteEmailRegex.test(email)) {
      return fail(res, 400, "Email must follow name.surname@vsit.edu.in format");
    }
    if (!isValidDepartment(department)) {
      return fail(res, 400, "Invalid department");
    }
    const exists = await User.findOne({ email });
    if (exists) return fail(res, 400, "Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const faculty = await User.create({
      name,
      email,
      userEmail: email,
      password: hashedPassword,
      role: "faculty",
      department,
      isVerified: true,
    });
    return ok(res, sanitizeUserResponse(faculty), 201);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[ADMIN][CREATE_FACULTY]", { body: req.body, error: error.message });
    if (error?.code === 11000) {
      return fail(res, 400, "Faculty email already exists");
    }
    if (error?.name === "ValidationError") {
      return fail(res, 400, error.message);
    }
    return fail(res, 500, "Failed to create faculty", error.message);
  }
};

const createAdmin = async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const email = sanitizeString(req.body.email);
    const password = sanitizeString(req.body.password);
    if (!name || !email || !password) return fail(res, 400, "All fields are required");
    if (!instituteEmailRegex.test(email)) {
      return fail(res, 400, "Email must follow name.surname@vsit.edu.in format");
    }
    const exists = await User.findOne({ email });
    if (exists) return fail(res, 400, "Email already exists");
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name,
      email,
      userEmail: email,
      password: hashedPassword,
      role: "admin",
      isVerified: true,
    });
    return ok(res, sanitizeUserResponse(admin), 201);
  } catch (error) {
    if (error?.code === 11000) return fail(res, 400, "Admin email already exists");
    if (error?.name === "ValidationError") return fail(res, 400, error.message);
    return fail(res, 500, "Failed to create admin", error.message);
  }
};

const getDeletionRequests = async (req, res) => {
  const requests = await DeletionRequest.find().sort({ createdAt: -1 });
  return ok(res, requests);
};

const updateDeletionRequestStatus = async (req, res) => {
  const status = sanitizeString(req.body.status);
  if (!["pending", "approved", "rejected"].includes(status)) {
    return fail(res, 400, "Invalid status");
  }
  const request = await DeletionRequest.findByIdAndUpdate(req.params.id, { status }, { returnDocument: "after" });
  if (!request) return fail(res, 404, "Request not found");
  if (status === "approved") await User.deleteOne({ studentId: request.studentId });
  return ok(res, request);
};

module.exports = { createFaculty, createAdmin, getDeletionRequests, updateDeletionRequestStatus };
