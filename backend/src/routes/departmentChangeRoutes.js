const express = require("express");
const {
  createDepartmentChangeRequest,
  getMyDepartmentChangeRequests,
  getAllDepartmentChangeRequests,
  approveDepartmentChangeRequest,
  rejectDepartmentChangeRequest,
} = require("../controllers/departmentChangeController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Student routes
router.post("/", protect, allowRoles("student"), createDepartmentChangeRequest);
router.get("/my", protect, allowRoles("student"), getMyDepartmentChangeRequests);

// Admin routes
router.get("/admin/all", protect, allowRoles("admin"), getAllDepartmentChangeRequests);
router.patch("/:id/approve", protect, allowRoles("admin"), approveDepartmentChangeRequest);
router.patch("/:id/reject", protect, allowRoles("admin"), rejectDepartmentChangeRequest);

module.exports = router;
