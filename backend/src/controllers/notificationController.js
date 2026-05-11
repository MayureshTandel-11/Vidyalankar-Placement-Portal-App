const Notification = require("../models/Notification");
const User = require("../models/User");
const Opportunity = require("../models/Opportunity");
const { ok, fail } = require("../utils/apiResponse");

/**
 * Create a notification for a student
 * @param {string} studentId - Student user ID
 * @param {string} opportunityId - Opportunity ID
 * @param {string} stage - Recruitment stage
 * @param {string} message - Notification message
 * @param {string} notificationType - Type: selection, rejection, general
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (studentId, opportunityId, stage, message, notificationType = "general") => {
  try {
    const notification = await Notification.create({
      studentId,
      opportunityId,
      stage,
      message,
      notificationType,
    });
    return notification;
  } catch (error) {
    console.error("[NOTIFICATION CREATE ERROR]", error);
    throw error;
  }
};

/**
 * Get notifications for a student
 * GET /api/notifications
 * Query: page, limit, isRead
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (page - 1) * limit;

    // Students can only access their own notifications
    if (req.user.role === "student") {
      const studentUser = await User.findById(req.user._id);
      if (!studentUser || studentUser.role !== "student") {
        return res.status(403).json({ message: "Unauthorized" });
      }
    }

    const query = { studentId: req.user._id };

    // Filter by read status if specified
    if (isRead !== undefined) {
      query.isRead = isRead === "true";
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("opportunityId", "announcementHeading");

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      studentId: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      data: notifications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
      message: "Notifications fetched successfully",
    });
  } catch (error) {
    console.error("[GET NOTIFICATIONS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch notifications" });
  }
};

/**
 * Mark notification as read
 * PATCH /api/notifications/:notificationId/read
 */
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Verify ownership
    if (String(notification.studentId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      data: notification,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("[MARK AS READ ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to mark notification as read" });
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { studentId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      data: result,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("[MARK ALL AS READ ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to mark all notifications as read" });
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Verify ownership or admin
    if (req.user.role !== "admin" && String(notification.studentId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Notification.deleteOne({ _id: notificationId });

    return res.status(200).json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE NOTIFICATION ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to delete notification" });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
