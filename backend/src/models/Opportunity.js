const mongoose = require("mongoose");
const { isValidOpportunityDepartment } = require("../constants/departments");
const { getStatusFromLastDate } = require("../utils/dateUtils");

// Status logic: Compare lastDate with today's start date
// ACTIVE until end of lastDate, ARCHIVED after lastDate day ends
const getOpportunityStatus = (lastDate) => {
  if (!lastDate) {
    console.log("[OPPORTUNITY MODEL] getOpportunityStatus: lastDate is null, returning 'active'");
    return "active";
  }

  console.log("[OPPORTUNITY MODEL] getOpportunityStatus - CALLING getStatusFromLastDate");
  console.log("[OPPORTUNITY MODEL] Raw lastDate:", lastDate);
  const status = getStatusFromLastDate(lastDate);
  console.log("[OPPORTUNITY MODEL]  Status derivation complete:", status);
  return status;
};

const opportunitySchema = new mongoose.Schema(
  {
    announcementHeading: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Internship", "Placement"], required: true },
    description: { type: String, required: true, maxlength: 10000 },
    eligibilityCriteria: { type: String, default: "" },
    lastDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    department: { type: String, required: true, trim: true },
    technicalSkills: [{ type: String, trim: true }],
    applicationLink: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdName: { type: String, required: true, trim: true },
    applications: [{
      studentId: { type: String, trim: true },
      studentEmail: { type: String, required: true, trim: true },
      studentName: { type: String, required: true, trim: true },
      studentDepartment: { type: String, required: true, trim: true },
      appliedAt: { type: Date, default: Date.now }
    }],
    activeStages: {
      type: [String],
      default: [],
      enum: [
        "Aptitude Test",
        "Group Discussion",
        "Technical Interview",
        "HR Interview",
        "Result",
      ],
    },
    // Track attendance submission status per stage
    stageAttendanceStatus: [{
      stage: {
        type: String,
        enum: [
          "Aptitude Test",
          "Group Discussion",
          "Technical Interview",
          "HR Interview",
          "Result",
        ],
      },
      isSubmitted: {
        type: Boolean,
        default: false,
      },
      submittedAt: Date,
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      totalRecords: {
        type: Number,
        default: 0,
      },
      presentCount: {
        type: Number,
        default: 0,
      },
      absentCount: {
        type: Number,
        default: 0,
      },
    }],
    // Track manual selections per stage (enabled after attendance submission)
    stageManualSelections: [{
      stage: {
        type: String,
        enum: [
          "Aptitude Test",
          "Group Discussion",
          "Technical Interview",
          "HR Interview",
          "Result",
        ],
      },
      selectedStudentIds: [
        {
          type: String, // studentId
        },
      ],
      nextRoundName: { type: String, trim: true },
      companyName: { type: String, trim: true },
      selectedAt: Date,
      selectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      _id: false,
    }],
    // Stage tracking: attended and selected students per stage
    stages: {
      aptitude: {
        attendedStudents: [{ type: String }], // studentId strings
        selectedStudents: [{ type: String }], // studentId strings
        _id: false,
      },
      groupDiscussion: {
        attendedStudents: [{ type: String }],
        selectedStudents: [{ type: String }],
        _id: false,
      },
      technicalInterview: {
        attendedStudents: [{ type: String }],
        selectedStudents: [{ type: String }],
        _id: false,
      },
      hrInterview: {
        attendedStudents: [{ type: String }],
        selectedStudents: [{ type: String }],
        _id: false,
      },
    },
  },
  { timestamps: true }
);

opportunitySchema.pre("validate", function validateDepartment() {
  if (!isValidOpportunityDepartment(this.department)) {
    throw new Error("Invalid department value");
  }
  console.log(`[OPPORTUNITY MODEL VALIDATE][PRE-HOOK] Setting status from lastDate`);
  this.status = getOpportunityStatus(this.lastDate);
  console.log(`[OPPORTUNITY MODEL VALIDATE][PRE-HOOK] Status set to: ${this.status}`);
});

opportunitySchema.index({ lastDate: 1 });
opportunitySchema.index({ createdAt: 1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);
