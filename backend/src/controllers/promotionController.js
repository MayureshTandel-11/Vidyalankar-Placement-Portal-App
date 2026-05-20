const User = require("../models/User");
const { DEPARTMENTS, YEAR_OPTIONS } = require("../constants/departments");
const { ok, fail } = require("../utils/apiResponse");

/**
 * Promotion mapping: FY -> SY, SY -> TY
 */
const PROMOTION_MAP = {
  "First Year": "Second Year",
  "Second Year": "Third Year",
};

/**
 * Check if a year is eligible for promotion
 */
const isPromotionEligible = (year) => {
  return PROMOTION_MAP.hasOwnProperty(year);
};

/**
 * Get promoted year value
 */
const getPromotedYear = (currentYear) => {
  return PROMOTION_MAP[currentYear] || null;
};

/**
 * GET /api/promotions/students
 * Fetch eligible students (FY, SY) based on filters
 * Admin: all departments
 * Faculty: only their department
 */
const getEligibleStudents = async (req, res) => {
  try {
    const { department, year, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter query
    let query = {
      role: "student",
      year: { $in: Object.keys(PROMOTION_MAP) }, // Only FY and SY
    };

    // Faculty: restrict to their department
    if (req.user.role === "faculty") {
      query.department = req.user.department;
    }

    // Admin/Faculty: apply department filter if provided
    if (req.user.role === "admin" && department) {
      if (DEPARTMENTS.includes(department)) {
        query.department = department;
      }
    }

    // Apply year filter
    if (year) {
      if (YEAR_OPTIONS.includes(year)) {
        query.year = year;
      }
    }

    // Search by name, studentId, or email
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { studentId: searchRegex },
        { email: searchRegex },
        { userEmail: searchRegex },
      ];
    }

    // Fetch students
    const students = await User.find(query)
      .select("_id name studentId email department year")
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Count total for pagination
    const total = await User.countDocuments(query);

    // Map students with promotion info
    const studentsWithPromotion = students.map((student) => ({
      _id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      department: student.department,
      currentYear: student.year,
      targetYear: getPromotedYear(student.year),
      isEligible: isPromotionEligible(student.year),
    }));

    return ok(res, {
      students: studentsWithPromotion,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[PROMOTIONS] getEligibleStudents error:", error);
    return fail(res, 500, "Failed to fetch eligible students", error.message);
  }
};

/**
 * PATCH /api/promotions/promote
 * Promote selected students to next year
 * Validates role permissions and promotion eligibility
 */
const promoteStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;

    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return fail(res, 400, "Please select at least one student to promote");
    }

    if (studentIds.length > 100) {
      return fail(res, 400, "Cannot promote more than 100 students at once");
    }

    // Fetch selected students
    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
    });

    if (students.length === 0) {
      return fail(res, 404, "No students found");
    }

    // Validate each student
    const invalidStudents = [];
    const promotionUpdates = [];

    for (const student of students) {
      // Check if promotion is eligible
      if (!isPromotionEligible(student.year)) {
        invalidStudents.push({
          studentId: student.studentId,
          name: student.name,
          reason: `Cannot promote ${student.year} students`,
        });
        continue;
      }

      // Faculty: check department access
      if (req.user.role === "faculty" && student.department !== req.user.department) {
        invalidStudents.push({
          studentId: student.studentId,
          name: student.name,
          reason: "Access denied: different department",
        });
        continue;
      }

      // Prepare update
      const newYear = getPromotedYear(student.year);
      promotionUpdates.push({
        _id: student._id,
        oldYear: student.year,
        newYear,
      });
    }

    // If some students are invalid but some are valid, proceed with valid ones
    let promotedCount = 0;
    if (promotionUpdates.length > 0) {
      // Update valid students
      for (const update of promotionUpdates) {
        await User.findByIdAndUpdate(
          update._id,
          { year: update.newYear },
          { new: true }
        );
        promotedCount++;
      }
    }

    // Build response
    const response = {
      promotedCount,
      totalSelected: studentIds.length,
      message:
        promotedCount === studentIds.length
          ? `Successfully promoted ${promotedCount} student(s)`
          : `Promoted ${promotedCount} of ${studentIds.length} student(s)`,
      invalidStudents: invalidStudents.length > 0 ? invalidStudents : undefined,
    };

    if (promotedCount === 0 && invalidStudents.length > 0) {
      return fail(res, 400, "Could not promote any students", response);
    }

    return ok(res, response, 200);
  } catch (error) {
    console.error("[PROMOTIONS] promoteStudents error:", error);
    return fail(res, 500, "Failed to promote students", error.message);
  }
};

module.exports = {
  getEligibleStudents,
  promoteStudents,
  isPromotionEligible,
  getPromotedYear,
};
