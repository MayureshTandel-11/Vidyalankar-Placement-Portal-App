const express = require("express");
const { requestDeletion } = require("../controllers/studentController");

const {
  getAllStudents,
  getStudentDetails,
  searchStudents,
  getYearOptions,
} = require("../controllers/studentManagementController");
const {
  getStudentAnalytics,
  getOpportunityAnalytics,
  getClassAnalytics,
  getOpportunityStateAnalytics,
  downloadStudentParticipationCSV,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ========================================
// Student self-service routes
// ========================================
router.post("/deletion-request", protect, allowRoles("student"), requestDeletion);

// ========================================
// Student Management Routes (Faculty/Admin)
// ========================================

// Get all students with pagination and filters
// Faculty: only their department
// Admin: all students
router.get("/management/list", protect, allowRoles("faculty", "admin"), getAllStudents);

// Search students
router.get("/management/search", protect, allowRoles("faculty", "admin"), searchStudents);

// Get year options
router.get("/management/years", protect, allowRoles("faculty", "admin"), getYearOptions);

// Get single student details
router.get("/management/:studentId", protect, allowRoles("faculty", "admin"), getStudentDetails);

// ========================================
// Analytics Routes
// ========================================

// IMPORTANT: /analytics/class and /analytics/opportunity/:... must be declared
// BEFORE /analytics/:studentId, otherwise Express matches "class" as a studentId param.

// Get class/department analytics (Faculty/Admin only)
router.get(
  "/analytics/class",
  protect,
  allowRoles("faculty", "admin"),
  getClassAnalytics
);

// Opportunity-state analytics (Faculty/Admin only)
router.get(
  "/analytics/opportunity-state",
  protect,
  allowRoles("faculty", "admin"),
  getOpportunityStateAnalytics
);

// Download student participation CSV (Faculty/Admin only)
router.get(
  "/analytics/participation/download",
  protect,
  allowRoles("faculty", "admin"),
  downloadStudentParticipationCSV
);

// Get opportunity-specific analytics
router.get(
  "/analytics/opportunity/:opportunityId/:studentId",
  protect,
  allowRoles("student", "faculty", "admin"),
  getOpportunityAnalytics
);

// Get student analytics (accessible by admin, faculty, and student themselves)
router.get(
  "/analytics/:studentId",
  protect,
  allowRoles("student", "faculty", "admin"),
  getStudentAnalytics
);



module.exports = router;
