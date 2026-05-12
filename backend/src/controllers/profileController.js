const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const { ok, fail } = require("../utils/apiResponse");
const { sanitizeUserResponse, sanitizeString } = require("../utils/sanitize");
const { ALLOWED_EXT, MIME_FOR_EXT } = require("../middleware/uploadMiddleware");

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateURL = (url) => {
  if (!url) return true;
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlRegex.test(url);
};

const validatePhone = (phone) => {
  return /^\d{10}$/.test(phone);
};

const isAllowedResumeFile = (filename) => {
  const ext = path.extname(filename || "").toLowerCase();
  return ALLOWED_EXT.has(ext);
};

// 1. Get Student Profile
const getStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can access their profile");
    }

    const student = await User.findById(req.user._id);
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    const profile = sanitizeUserResponse(student);

    // Ensure profile has default structure if fields are missing
    const profileWithDefaults = {
      ...profile,
      academicInfo: profile.academicInfo || {},
      technicalSkills: profile.technicalSkills || [],
      certifications: profile.certifications || [],
      projects: profile.projects || [],
      professionalLinks: profile.professionalLinks || { linkedinProfile: "", githubProfile: "", almaShineProfile: "" },
      resume: profile.resume || {
        fileName: "",
        filePath: "",
        mimeType: "",
        resumeUrl: "",
        uploadedAt: null,
      },
    };

    return ok(res, { profile: profileWithDefaults });
  } catch (error) {
    console.error("[Profile Error]", error);
    return fail(res, 500, "Error fetching profile", error.message);
  }
};

// 2. Update Academic Info and Year
const updateAcademicInfo = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update academic info");
    }

    const { year, sscPercentage, hscPercentage, cgpa, phone } = req.body;

    if (year && !["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(year)) {
      return fail(res, 400, "Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year");
    }

    const toOptionalNumber = (value, min, max, label) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new Error(`${label} must be a number`);
      }
      if (n < min || n > max) {
        throw new Error(`${label} must be between ${min} and ${max}`);
      }
      return n;
    };

    const existing = await User.findById(req.user._id);
    if (!existing) {
      return fail(res, 404, "Student not found");
    }

    const prevAi = existing.academicInfo || {};

    let sscNum;
    let hscNum;
    let cgpaNum;
    try {
      sscNum = toOptionalNumber(sscPercentage, 0, 100, "SSC percentage");
      hscNum = toOptionalNumber(hscPercentage, 0, 100, "HSC percentage");
      cgpaNum = toOptionalNumber(cgpa, 0, 10, "CGPA");
    } catch (e) {
      return fail(res, 400, e.message);
    }

    const academicInfo = {
      ...prevAi,
      ...(sscNum !== undefined ? { sscPercentage: sscNum } : {}),
      ...(hscNum !== undefined ? { hscPercentage: hscNum } : {}),
      ...(cgpaNum !== undefined ? { cgpa: cgpaNum } : {}),
    };

    if (year) {
      academicInfo.year = parseInt(String(year).charAt(0), 10);
    }

    const $set = { academicInfo };

    if (year) {
      $set.year = year;
    }

    if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
      if (!validatePhone(phone)) {
        return fail(res, 400, "Phone must be exactly 10 digits");
      }
      $set.phone = String(phone).trim();
    }

    const student = await User.findOneAndUpdate(
      { _id: req.user._id, role: "student" },
      { $set },
      { new: true, runValidators: true, upsert: false }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, {
      year: student.year,
      academicInfo: student.academicInfo,
      phone: student.phone,
    });
  } catch (error) {
    return fail(res, 500, "Error updating academic info", error.message);
  }
};

// 3. Update Technical Skills
const updateTechnicalSkills = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update technical skills");
    }

    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return fail(res, 400, "Skills must be an array");
    }

    const sanitizedSkills = skills.map((skill) => sanitizeString(skill)).filter(Boolean);

    const student = await User.findOneAndUpdate(
      { _id: req.user._id, role: "student" },
      { $set: { technicalSkills: sanitizedSkills } },
      { new: true, runValidators: true, upsert: false }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { technicalSkills: student.technicalSkills });
  } catch (error) {
    return fail(res, 500, "Error updating technical skills", error.message);
  }
};

// 4. Add Certification
const addCertification = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can add certifications");
    }

    const { title, issuer, issueDate } = req.body;

    if (!title || !issuer) {
      return fail(res, 400, "Title and issuer are required");
    }

    const certification = {
      title: sanitizeString(title),
      issuer: sanitizeString(issuer),
      issueDate: issueDate ? new Date(issueDate) : undefined,
    };

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { certifications: certification } },
      { returnDocument: "after", runValidators: true }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { certifications: student.certifications }, 201);
  } catch (error) {
    return fail(res, 500, "Error adding certification", error.message);
  }
};

// 5. Update Certification
const updateCertification = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update certifications");
    }

    const { certificationId, title, issuer, issueDate } = req.body;

    if (!certificationId) {
      return fail(res, 400, "Certification ID is required");
    }

    if (!title || !issuer) {
      return fail(res, 400, "Title and issuer are required");
    }

    const student = await User.findById(req.user._id);
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    const certIndex = student.certifications.findIndex(
      (cert) => cert._id.toString() === certificationId
    );

    if (certIndex === -1) {
      return fail(res, 404, "Certification not found");
    }

    student.certifications[certIndex] = {
      ...student.certifications[certIndex]._doc,
      title: sanitizeString(title),
      issuer: sanitizeString(issuer),
      issueDate: issueDate ? new Date(issueDate) : student.certifications[certIndex].issueDate,
    };

    await student.save();

    return ok(res, { certifications: student.certifications });
  } catch (error) {
    return fail(res, 500, "Error updating certification", error.message);
  }
};

// 6. Delete Certification
const deleteCertification = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can delete certifications");
    }

    const { certificationId } = req.body;

    if (!certificationId) {
      return fail(res, 400, "Certification ID is required");
    }

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { certifications: { _id: certificationId } } },
      { returnDocument: "after" }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { certifications: student.certifications });
  } catch (error) {
    return fail(res, 500, "Error deleting certification", error.message);
  }
};

// 7. Add Project
const addProject = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can add projects");
    }

    const { title, description, technologies, link } = req.body;

    if (!title || !description) {
      return fail(res, 400, "Title and description are required");
    }

    if (link && !validateURL(link)) {
      return fail(res, 400, "Invalid project link URL");
    }

    const project = {
      title: sanitizeString(title),
      description: sanitizeString(description),
      technologies: Array.isArray(technologies)
        ? technologies.map((tech) => sanitizeString(tech)).filter(Boolean)
        : [],
      link: link ? sanitizeString(link) : undefined,
    };

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { projects: project } },
      { returnDocument: "after", runValidators: true }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { projects: student.projects }, 201);
  } catch (error) {
    return fail(res, 500, "Error adding project", error.message);
  }
};

// 8. Update Project
const updateProject = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update projects");
    }

    const { projectId, title, description, technologies, link } = req.body;

    if (!projectId) {
      return fail(res, 400, "Project ID is required");
    }

    if (!title || !description) {
      return fail(res, 400, "Title and description are required");
    }

    if (link && !validateURL(link)) {
      return fail(res, 400, "Invalid project link URL");
    }

    const student = await User.findById(req.user._id);
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    const projIndex = student.projects.findIndex(
      (proj) => proj._id.toString() === projectId
    );

    if (projIndex === -1) {
      return fail(res, 404, "Project not found");
    }

    student.projects[projIndex] = {
      ...student.projects[projIndex]._doc,
      title: sanitizeString(title),
      description: sanitizeString(description),
      technologies: Array.isArray(technologies)
        ? technologies.map((tech) => sanitizeString(tech)).filter(Boolean)
        : student.projects[projIndex].technologies,
      link: link ? sanitizeString(link) : student.projects[projIndex].link,
    };

    await student.save();

    return ok(res, { projects: student.projects });
  } catch (error) {
    return fail(res, 500, "Error updating project", error.message);
  }
};

// 9. Delete Project
const deleteProject = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can delete projects");
    }

    const { projectId } = req.body;

    if (!projectId) {
      return fail(res, 400, "Project ID is required");
    }

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { projects: { _id: projectId } } },
      { returnDocument: "after" }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { projects: student.projects });
  } catch (error) {
    return fail(res, 500, "Error deleting project", error.message);
  }
};

// 10. Upload Resume
const uploadResume = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can upload resumes");
    }

    // Check if file is provided
    if (!req.file) {
      return fail(res, 400, "Resume file is required");
    }

    if (!isAllowedResumeFile(req.file.originalname)) {
      return fail(res, 400, "Resume must be a PDF, DOC, or DOCX file");
    }

    // Validate file size (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > MAX_FILE_SIZE) {
      return fail(res, 400, "Resume file size must be less than 5MB");
    }

    const relativePath = `uploads/resumes/${req.file.filename}`;
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const mimeType = req.file.mimetype || MIME_FOR_EXT[ext] || "application/octet-stream";

    const student = await User.findByIdAndUpdate(
      req.user._id,
      {
        resume: {
          fileName: sanitizeString(req.file.originalname || req.file.filename),
          filePath: sanitizeString(relativePath),
          mimeType: sanitizeString(mimeType),
          resumeUrl: sanitizeString(relativePath),
          uploadedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, {
      resume: student.resume,
    }, 201);
  } catch (error) {
    return fail(res, 500, "Error uploading resume", error.message);
  }
};

// 11. Update Professional Links
const updateProfessionalLinks = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update professional links");
    }

    const { linkedinProfile, githubProfile, almaShineProfile } = req.body;

    // Validate URLs
    if (linkedinProfile && !validateURL(linkedinProfile)) {
      return fail(res, 400, "Invalid LinkedIn profile URL");
    }

    if (githubProfile && !validateURL(githubProfile)) {
      return fail(res, 400, "Invalid GitHub profile URL");
    }

    if (almaShineProfile && !validateURL(almaShineProfile)) {
      return fail(res, 400, "Invalid AlmaShine profile URL");
    }

    const existing = await User.findById(req.user._id).select("professionalLinks");
    if (!existing) {
      return fail(res, 404, "Student not found");
    }

    const prev = existing.professionalLinks || {};
    const professionalLinks = {
      linkedinProfile:
        linkedinProfile !== undefined
          ? sanitizeString(linkedinProfile || "")
          : prev.linkedinProfile || "",
      githubProfile:
        githubProfile !== undefined
          ? sanitizeString(githubProfile || "")
          : prev.githubProfile || "",
      almaShineProfile:
        almaShineProfile !== undefined
          ? sanitizeString(almaShineProfile || "")
          : prev.almaShineProfile || "",
    };

    const student = await User.findOneAndUpdate(
      { _id: req.user._id, role: "student" },
      { $set: { professionalLinks } },
      { new: true, runValidators: true, upsert: false }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { professionalLinks: student.professionalLinks });
  } catch (error) {
    return fail(res, 500, "Error updating professional links", error.message);
  }
};

// 12. Update Student ID
const updateStudentId = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can update student ID");
    }

    const { studentId } = req.body;

    if (!studentId || !sanitizeString(studentId)) {
      return fail(res, 400, "Student ID is required");
    }

    const sanitizedStudentId = sanitizeString(studentId);

    // Check if another student already has this ID
    const existing = await User.findOne({ studentId: sanitizedStudentId, _id: { $ne: req.user._id } });
    if (existing) {
      return fail(res, 400, "This student ID is already in use");
    }

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { studentId: sanitizedStudentId },
      { returnDocument: "after", runValidators: true }
    );

    if (!student) {
      return fail(res, 404, "Student not found");
    }

    return ok(res, { studentId: student.studentId });
  } catch (error) {
    return fail(res, 500, "Error updating student ID", error.message);
  }
};

// Download Resume
// GET /api/student/profile/resume/download/:studentId
// Faculty can download only from their department
// Admin can download any student's resume
const downloadResume = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate input
    if (!studentId || studentId === "null") {
      return fail(res, 400, "Invalid student ID");
    }

    // Find student
    const student = await User.findOne({ studentId }).lean();
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    // Check authorization
    if (req.user.role === "faculty") {
      const a = String(student.department || "").trim().toLowerCase();
      const b = String(req.user.department || "").trim().toLowerCase();
      if (!a || !b || a !== b) {
        return fail(res, 403, "You can only download resumes for students in your department");
      }
    }

    const rel = student.resume?.filePath || student.resume?.resumeUrl;
    if (!rel || !String(rel).trim()) {
      return fail(res, 404, "No resume uploaded for this student");
    }

    console.log(`[RESUME DOWNLOAD] Student: ${student.name} (${studentId}), Path: ${rel}, By: ${req.user.email}`);

    if (String(rel).startsWith("http")) {
      console.log("[RESUME] Redirecting to external URL:", rel);
      return res.redirect(rel);
    }

    const absolutePath = path.join(__dirname, "../../", rel);
    console.log("[RESUME] Serving local file:", absolutePath);

    if (!fs.existsSync(absolutePath)) {
      console.error("[RESUME] File not found:", absolutePath);
      return fail(res, 404, "Resume file not found on server");
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const mime = student.resume?.mimeType || MIME_FOR_EXT[ext] || "application/octet-stream";
    const baseName = (student.resume?.fileName && path.basename(student.resume.fileName)) || `${student.fullName || student.name || "resume"}_${studentId}${ext}`;

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(baseName)}"`);

    return res.download(absolutePath, baseName, (err) => {
      if (err) {
        console.error("[RESUME DOWNLOAD ERROR]", err.message);
      } else {
        console.log("[RESUME ✓] Successfully sent resume for:", student.email);
      }
    });
  } catch (error) {
    console.error("[DOWNLOAD RESUME ERROR]", error);
    return fail(res, 500, "Error downloading resume", error.message);
  }
};

module.exports = {
  getStudentProfile,
  updateAcademicInfo,
  updateTechnicalSkills,
  addCertification,
  updateCertification,
  deleteCertification,
  addProject,
  updateProject,
  deleteProject,
  uploadResume,
  updateProfessionalLinks,
  updateStudentId,
  downloadResume,
};
