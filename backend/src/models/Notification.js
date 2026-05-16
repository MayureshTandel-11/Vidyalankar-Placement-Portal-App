const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: [
        "Aptitude Test",
        "Group Discussion",
        "Technical Interview",
        "HR Interview",
        "Result",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    notificationType: {
      type: String,
      enum: ["selection", "rejection", "general"],
      default: "general",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
notificationSchema.index({ studentId: 1, createdAt: -1 });
notificationSchema.index({ studentId: 1, isRead: 1 });

// FIX: PREVENT DUPLICATE SELECTION NOTIFICATIONS
// Unique compound index ensures exactly ONE selection notification per student per opportunity per stage
// This prevents duplicate congratulations messages from multiple API calls
notificationSchema.index(
  { studentId: 1, opportunityId: 1, stage: 1, notificationType: 1 },
  {
    unique: true,
    sparse: true,  // Allow multiple notifications of different types
    partialFilterExpression: {
      notificationType: "selection",  // Only enforce uniqueness for selection notifications
    },
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
