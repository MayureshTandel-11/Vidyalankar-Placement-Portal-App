const mongoose = require("mongoose");
const { DEPARTMENTS, YEAR_OPTIONS } = require("../constants/departments");

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CAREER_SURVEY_OPTIONS = ["Placement", "Masters", "Startup", "Business"];

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
    // Year field for students (First Year, Second Year, Third Year, Masters)
    year: {
      type: String,
      enum: YEAR_OPTIONS,
      required: function () {
        return this.role === "student";
      },
    },
    personalGmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Personal Gmail must be a valid email address",
      },
    },
    gender: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true;
          return GENDER_OPTIONS.includes(v);
        },
        message: "Gender must be Male, Female, or Other",
      },
    },
    division: {
      type: String,
      trim: true,
      default: "",
    },
    careerSurvey: {
      type: [String],
      enum: CAREER_SURVEY_OPTIONS,
      default: [],
      validate: {
        validator: function (v) {
          if (!Array.isArray(v)) return false;
          return new Set(v).size === v.length;
        },
        message: "Career survey options must be unique",
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
    studentPhoto: {
      data: { type: String },
      contentType: { type: String, trim: true },
      fileName: { type: String, trim: true },
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

const User = mongoose.model("User", userSchema);

module.exports = User;
module.exports.GENDER_OPTIONS = GENDER_OPTIONS;
module.exports.CAREER_SURVEY_OPTIONS = CAREER_SURVEY_OPTIONS;
