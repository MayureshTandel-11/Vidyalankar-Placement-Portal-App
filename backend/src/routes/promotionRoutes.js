const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getEligibleStudents,
  promoteStudents,
} = require("../controllers/promotionController");

const router = express.Router();

/**
 * Promotion Routes
 * Accessible by Admin and Faculty only
 */

/**
 * GET /api/promotions/students
 * Fetch eligible students (FY, SY) with filters
 * Admin: can filter by department
 * Faculty: restricted to own department
 */
router.get(
  "/students",
  protect,
  allowRoles("admin", "faculty"),
  getEligibleStudents
);

/**
 * PATCH /api/promotions/promote
 * Promote selected students to next year
 * Body: { studentIds: ["id1", "id2", ...] }
 */
router.patch(
  "/promote",
  protect,
  allowRoles("admin", "faculty"),
  promoteStudents
);

module.exports = router;
