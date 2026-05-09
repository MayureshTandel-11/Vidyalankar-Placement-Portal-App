const mongoose = require("mongoose");

const opportunityAttendanceSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    studentId: {
      type: String,
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
    status: {
      type: String,
      enum: ["present", "absent", "pending"],
      default: "pending",
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    markedAt: {
      type: Date,
      default: null,
    },
    // Submission tracking fields
    isSubmitted: {
      type: Boolean,
      default: false,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicates
opportunityAttendanceSchema.index(
  { opportunityId: 1, studentId: 1, stage: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: "string" } } }
);

module.exports = mongoose.model("OpportunityAttendance", opportunityAttendanceSchema);
