const mongoose = require("mongoose");
const { DEPARTMENTS } = require("../constants/departments");

const departmentChangeRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    currentDepartment: {
      type: String,
      enum: DEPARTMENTS,
      required: true,
      trim: true,
    },
    requestedDepartment: {
      type: String,
      enum: DEPARTMENTS,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    adminRemark: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
departmentChangeRequestSchema.index({ studentId: 1, status: 1 });
departmentChangeRequestSchema.index({ studentId: 1, createdAt: -1 });
departmentChangeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("DepartmentChangeRequest", departmentChangeRequestSchema);
