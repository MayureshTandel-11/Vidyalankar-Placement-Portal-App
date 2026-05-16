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
    // FIX: Add type field to differentiate between congratulation messages and general comments
    // This allows unique constraint on (opportunityId, studentId, stage, type) instead of full comment
    type: {
      type: String,
      enum: ["ROUND_SELECTION", "GENERAL"],
      default: "GENERAL",
      index: true,
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
// Compound index for timeline filtering
opportunityTimelineSchema.index({ opportunityId: 1, studentId: 1, stage: 1 });
// FIX: PREVENT DUPLICATE CONGRATULATION TIMELINE ENTRIES
// Unique compound index ensures:
// - Exactly one congratulation message per student per stage per opportunity
// - Prevents race conditions and concurrent duplicate insertions
// - Uses type field to differentiate message types instead of full comment text
opportunityTimelineSchema.index(
  { opportunityId: 1, studentId: 1, stage: 1, type: 1 },
  {
    unique: true,
    sparse: true,  // Allow multiple null studentIds for general stage activation entries
    partialFilterExpression: {
      studentId: { $exists: true, $ne: null },  // Only enforce uniqueness for student-specific entries
    },
  }
);

module.exports = mongoose.model("OpportunityTimeline", opportunityTimelineSchema);
