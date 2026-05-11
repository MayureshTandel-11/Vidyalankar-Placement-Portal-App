const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const router = express.Router();

// All routes require authentication (students only)
router.use(protect);
router.use(allowRoles("student"));

// GET /api/notifications - Get all notifications for logged-in student
router.get("/", getNotifications);

// PATCH /api/notifications/:notificationId/read - Mark single notification as read
router.patch("/:notificationId/read", markAsRead);

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch("/read-all", markAllAsRead);

// DELETE /api/notifications/:notificationId - Delete a notification
router.delete("/:notificationId", deleteNotification);

module.exports = router;
