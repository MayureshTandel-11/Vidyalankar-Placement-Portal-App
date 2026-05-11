const mongoose = require("mongoose");
const { DEPARTMENTS } = require("../constants/departments");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Full name for sorting purposes (populated from name or explicit field)
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    userEmail: { type: String, lowercase: true, trim: true },
    studentId: { type: String, trim: true },
    role: {
      type: String,
      enum: ["admin", "faculty", "student"],
      required: true,
    },
    department: {
      type: String,
      required: function requiredDepartment() {
        return this.role !== "admin";
      },
      enum: DEPARTMENTS,
      trim: true,
    },
    password: {
      type: String,
      required: function requiredPassword() {
        return ["admin", "faculty", "student"].includes(this.role);
      },
    },
    isVerified: { type: Boolean, default: false },
    phone: {
      type: String,
      required: function () {
        return this.role === "student";
      },
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role !== "student" && !v) return true;
          return /^\d{10}$/.test(v);
        },
        message: "Phone number must be exactly 10 digits",
      },
    },
    // Year field for students (1st, 2nd, 3rd, 4th year)
    year: {
      type: String,
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
      required: function () {
        return this.role === "student";
      },
    },
    academicInfo: {
      year: {
        type: Number,
        min: 1,
        max: 4,
        validate: {
          validator: function (v) {
            if (!v) return true;
            return v >= 1 && v <= 4;
          },
          message: "Year must be between 1 and 4",
        },
      },
      sscPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      hscPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      cgpa: {
        type: Number,
        min: 0,
        max: 10,
        validate: {
          validator: function (v) {
            if (!v) return true;
            return v >= 0 && v <= 10;
          },
          message: "CGPA must be between 0 and 10",
        },
      },
    },
    technicalSkills: [{ type: String, trim: true }],
    certifications: [
      {
        title: { type: String, trim: true },
        issuer: { type: String, trim: true },
        issueDate: { type: Date },
        _id: false,
      },
    ],
    projects: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        technologies: [{ type: String, trim: true }],
        link: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true;
              const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
              return urlRegex.test(v);
            },
            message: "Invalid project link URL",
          },
        },
        _id: false,
      },
    ],
    resume: {
      fileName: { type: String, trim: true },
      filePath: { type: String, trim: true },
      mimeType: { type: String, trim: true },
      resumeUrl: {
        type: String,
        trim: true,
      },
      uploadedAt: { type: Date },
      _id: false,
    },
    professionalLinks: {
      linkedinProfile: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true;
            const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
            return urlRegex.test(v);
          },
          message: "Invalid LinkedIn profile URL",
        },
      },
      githubProfile: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true;
            const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
            return urlRegex.test(v);
          },
          message: "Invalid GitHub profile URL",
        },
      },
      almaShineProfile: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true;
            const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
            return urlRegex.test(v);
          },
          message: "Invalid AlmaShine profile URL",
        },
      },
      _id: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("validate", function validateIdentity() {
  if (!this.userEmail) {
    this.userEmail = this.email || this.studentId;
  }
  // Populate fullName from name if not explicitly set
  if (!this.fullName) {
    this.fullName = this.name;
  }
  if (this.role === "student" && !this.studentId) {
    throw new Error("studentId is required for students");
  }
  if ((this.role === "admin" || this.role === "faculty") && !this.email) {
    throw new Error("email is required for admin/faculty");
  }
});

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });
// Indexes for efficient sorting and filtering
userSchema.index({ fullName: 1 });
userSchema.index({ department: 1, year: 1 });
userSchema.index({ department: 1, role: 1 });

module.exports = mongoose.model("User", userSchema);
