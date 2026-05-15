const mongoose = require("mongoose");

const opportunityTimelineSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    // FIX ISSUE 1: Added studentId to enable per-student duplicate detection for Result stage
    // Allows tracking which student received a final result comment
    studentId: {
      type: String,
      index: true,
      default: null,  // null for general stage activation entries, populated for student-specific entries
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["faculty", "admin"],
      required: true,
    },
    stage: {
      type: String,
      enum: [
        "Aptitude Test",
        "Group Discussion",
        "Technical Interview",
        "HR Interview",
        "Result",
        "General Update",
      ],
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    isStageActivation: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

opportunityTimelineSchema.index({ opportunityId: 1, createdAt: -1 });
// FIX ISSUE 1: Added compound index for per-student Result stage duplicate detection
opportunityTimelineSchema.index({ opportunityId: 1, studentId: 1, stage: 1 });

module.exports = mongoose.model("OpportunityTimeline", opportunityTimelineSchema);
