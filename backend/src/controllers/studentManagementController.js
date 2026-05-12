const User = require("../models/User");
const Opportunity = require("../models/Opportunity");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const { sanitizeString } = require("../utils/sanitize");
const { ok } = require("../utils/apiResponse");

/**
 * Get all students (Faculty/Admin only)
 * Faculty: only their department students
 * Admin: all students
 * GET /api/student/management/list
 * Query: page, limit, department, year, search
 */
const getAllStudents = async (req, res) => {
  try {
    const { page = 1, limit = 20, department, year, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query based on role
    let query = { role: "student" };

    // Faculty can only see students from their department
    if (req.user.role === "faculty") {
      query.department = req.user.department;
    }

    // Filter by department (admin only if not faculty)
    if (department && req.user.role === "admin") {
      query.department = department;
    }

    // Filter by year
    if (year) {
      query.year = year;
    }

    // Search by name, email, or PRN
    if (search) {
      const sanitizedSearch = sanitizeString(search);
      query.$or = [
        { fullName: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
        { studentId: { $regex: sanitizedSearch, $options: "i" } },
      ];
    }

    // Fetch students sorted by fullName
    const students = await User.find(query)
      .select(
        "name fullName email studentId department year phone academicInfo.cgpa studentPhoto.fileName studentPhoto.contentType"
      )
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);

    return ok(res, {
      students,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error("[GET STUDENTS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch students" });
  }
};

/**
 * Get single student details
 * GET /api/student/management/:studentId
 */
const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ studentId }).select("-password -studentPhoto.data").lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check authorization (faculty can only view their department students)
    if (req.user.role === "faculty" && student.department !== req.user.department) {
      return res.status(403).json({ message: "You can only view students from your department" });
    }

    // Get student's applied opportunities
    const opportunities = await Opportunity.find({
      "applications.studentId": studentId,
    }).select("announcementHeading type department lastDate status").lean();

    return res.status(200).json({
      data: {
        ...student,
        opportunities,
      },
      message: "Student details fetched successfully",
    });
  } catch (error) {
    console.error("[GET STUDENT DETAILS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch student details" });
  }
};

/**
 * Search students by name, email, or PRN
 * GET /api/student/management/search
 * Query: q, department (for filtering), limit
 */
const searchStudents = async (req, res) => {
  try {
    const { q, department, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ message: "Search query must be at least 2 characters" });
    }

    const sanitizedSearch = sanitizeString(q);

    let query = {
      role: "student",
      $or: [
        { fullName: { $regex: sanitizedSearch, $options: "i" } },
        { email: { $regex: sanitizedSearch, $options: "i" } },
        { studentId: { $regex: sanitizedSearch, $options: "i" } },
      ],
    };

    // Filter by department if specified
    if (department) {
      query.department = department;
    }

    // Faculty can only search their department
    if (req.user.role === "faculty") {
      query.department = req.user.department;
    }

    const students = await User.find(query)
      .select("name fullName email studentId department year")
      .sort({ fullName: 1 })
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      data: students,
      message: "Students searched successfully",
    });
  } catch (error) {
    console.error("[SEARCH STUDENTS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to search students" });
  }
};

/**
 * Get available years dropdown options
 * GET /api/student/management/years
 */
const getYearOptions = async (req, res) => {
  try {
    const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    return res.status(200).json({
      data: years,
      message: "Years fetched successfully",
    });
  } catch (error) {
    console.error("[GET YEARS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch years" });
  }
};

module.exports = {
  getAllStudents,
  getStudentDetails,
  searchStudents,
  getYearOptions,
};
