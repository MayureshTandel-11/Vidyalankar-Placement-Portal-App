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
    // Recruitment round that triggered a ROUND_SELECTION entry (badge stage is "General Update")
    sourceStage: {
      type: String,
      enum: [
        "Aptitude Test",
        "Group Discussion",
        "Technical Interview",
        "HR Interview",
      ],
      default: null,
      index: true,
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
// One ROUND_SELECTION congratulations per student per source round (manual selection)
opportunityTimelineSchema.index(
  { opportunityId: 1, studentId: 1, sourceStage: 1, type: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      studentId: { $exists: true, $ne: null },
      sourceStage: { $exists: true, $ne: null },
      type: "ROUND_SELECTION",
    },
  }
);

module.exports = mongoose.model("OpportunityTimeline", opportunityTimelineSchema);
