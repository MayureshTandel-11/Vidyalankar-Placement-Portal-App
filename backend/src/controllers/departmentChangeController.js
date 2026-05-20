const DepartmentChangeRequest = require("../models/DepartmentChangeRequest");
const User = require("../models/User");
const { sanitizeString } = require("../utils/sanitize");
const { isValidDepartment } = require("../constants/departments");
const { ok, fail } = require("../utils/apiResponse");

/**
 * Student: Create a new department change request
 */
const createDepartmentChangeRequest = async (req, res) => {
  try {
    const studentId = req.user._id;
    const requestedDepartment = sanitizeString(req.body.requestedDepartment);
    const reason = sanitizeString(req.body.reason) || "";

    // Validate requested department
    if (!requestedDepartment || !isValidDepartment(requestedDepartment)) {
      return fail(res, 400, "Invalid requested department");
    }

    // Get student's current department
    const student = await User.findById(studentId);
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    const currentDepartment = student.department;

    // Validation: Cannot request the same department
    if (currentDepartment === requestedDepartment) {
      return fail(res, 400, "Cannot request the same department");
    }

    // Validation: Check if student already has a pending request
    const existingPending = await DepartmentChangeRequest.findOne({
      studentId,
      status: "pending",
    });
    if (existingPending) {
      return fail(res, 400, "You already have a pending department change request");
    }

    // Create new request
    const request = await DepartmentChangeRequest.create({
      studentId,
      currentDepartment,
      requestedDepartment,
      reason,
    });

    return ok(res, request, 201);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DEPARTMENT_CHANGE][CREATE]", { body: req.body, error: error.message });
    if (error?.name === "ValidationError") {
      return fail(res, 400, error.message);
    }
    return fail(res, 500, "Failed to create department change request", error.message);
  }
};

/**
 * Student: Get their own department change requests
 */
const getMyDepartmentChangeRequests = async (req, res) => {
  try {
    const studentId = req.user._id;

    const requests = await DepartmentChangeRequest.find({ studentId }).sort({
      createdAt: -1,
    });

    return ok(res, requests);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DEPARTMENT_CHANGE][GET_MY]", { error: error.message });
    return fail(res, 500, "Failed to fetch requests", error.message);
  }
};

/**
 * Admin: Get all department change requests
 */
const getAllDepartmentChangeRequests = async (req, res) => {
  try {
    const requests = await DepartmentChangeRequest.find()
      .populate({
        path: "studentId",
        select: "name email studentId department",
      })
      .sort({ createdAt: -1 });

    return ok(res, requests);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DEPARTMENT_CHANGE][GET_ALL]", { error: error.message });
    return fail(res, 500, "Failed to fetch requests", error.message);
  }
};

/**
 * Admin: Approve a department change request
 */
const approveDepartmentChangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const adminRemark = sanitizeString(req.body.adminRemark) || "";

    // Find the request
    const request = await DepartmentChangeRequest.findById(requestId);
    if (!request) {
      return fail(res, 404, "Department change request not found");
    }

    // Check if already processed
    if (request.status !== "pending") {
      return fail(res, 400, `Request is already ${request.status}`);
    }

    // Update student's department
    const student = await User.findByIdAndUpdate(
      request.studentId,
      { department: request.requestedDepartment },
      { new: true, runValidators: true }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    // Update request status
    request.status = "approved";
    request.adminRemark = adminRemark;
    await request.save();

    return ok(res, request);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DEPARTMENT_CHANGE][APPROVE]", { params: req.params, error: error.message });
    if (error?.name === "ValidationError") {
      return fail(res, 400, error.message);
    }
    return fail(res, 500, "Failed to approve request", error.message);
  }
};

/**
 * Admin: Reject a department change request
 */
const rejectDepartmentChangeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const adminRemark = sanitizeString(req.body.adminRemark) || "";

    // Find the request
    const request = await DepartmentChangeRequest.findById(requestId);
    if (!request) {
      return fail(res, 404, "Department change request not found");
    }

    // Check if already processed
    if (request.status !== "pending") {
      return fail(res, 400, `Request is already ${request.status}`);
    }

    // Update request status
    request.status = "rejected";
    request.adminRemark = adminRemark;
    await request.save();

    return ok(res, request);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[DEPARTMENT_CHANGE][REJECT]", { params: req.params, error: error.message });
    if (error?.name === "ValidationError") {
      return fail(res, 400, error.message);
    }
    return fail(res, 500, "Failed to reject request", error.message);
  }
};

module.exports = {
  createDepartmentChangeRequest,
  getMyDepartmentChangeRequests,
  getAllDepartmentChangeRequests,
  approveDepartmentChangeRequest,
  rejectDepartmentChangeRequest,
};
