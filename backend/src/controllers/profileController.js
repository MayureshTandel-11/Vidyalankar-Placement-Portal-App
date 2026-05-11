const User = require("../models/User");
const { ok, fail } = require("../utils/apiResponse");
const { sanitizeUserResponse, sanitizeString } = require("../utils/sanitize");

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

const isPdfFile = (filename) => {
  return filename.endsWith(".pdf") || filename.includes("pdf");
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
      resume: profile.resume || { resumeUrl: "", uploadedAt: null },
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

    // Validate inputs
    if (year && !["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(year)) {
      return fail(res, 400, "Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year");
    }

    if (sscPercentage && (sscPercentage < 0 || sscPercentage > 100)) {
      return fail(res, 400, "SSC percentage must be between 0 and 100");
    }

    if (hscPercentage && (hscPercentage < 0 || hscPercentage > 100)) {
      return fail(res, 400, "HSC percentage must be between 0 and 100");
    }

    if (cgpa && (cgpa < 0 || cgpa > 10)) {
      return fail(res, 400, "CGPA must be between 0 and 10");
    }

    if (phone && !validatePhone(phone)) {
      return fail(res, 400, "Phone must be exactly 10 digits");
    }

    // Prepare update object
    const updateData = {
      academicInfo: {
        sscPercentage,
        hscPercentage,
        cgpa,
      },
    };

    // Handle year - update both academicInfo and top-level year field
    if (year) {
      updateData.year = year;
      updateData.academicInfo.year = parseInt(year.charAt(0)); // Convert "1st Year" to 1, etc.
    }

    // Remove undefined values
    Object.keys(updateData.academicInfo).forEach(
      (key) =>
        updateData.academicInfo[key] === undefined &&
        delete updateData.academicInfo[key]
    );

    // Add phone if provided
    if (phone) {
      updateData.phone = phone;
    }

    const student = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
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

    const student = await User.findByIdAndUpdate(
      req.user._id,
      { technicalSkills: sanitizedSkills },
      { new: true, runValidators: true }
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
      { new: true, runValidators: true }
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
      { new: true }
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
      { new: true, runValidators: true }
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
      { new: true }
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

    // Validate file type
    if (!isPdfFile(req.file.originalname)) {
      return fail(res, 400, "Resume must be a PDF file");
    }

    // Validate file size (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > MAX_FILE_SIZE) {
      return fail(res, 400, "Resume file size must be less than 5MB");
    }

    // Construct resume URL/path
    // This assumes file is stored at uploads/resume/{studentId}/{filename}
    const resumeUrl = `uploads/resume/${req.user._id}/${req.file.filename}`;

    const student = await User.findByIdAndUpdate(
      req.user._id,
      {
        resume: {
          resumeUrl: sanitizeString(resumeUrl),
          uploadedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
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

    const updateData = {
      professionalLinks: {
        linkedinProfile: linkedinProfile ? sanitizeString(linkedinProfile) : undefined,
        githubProfile: githubProfile ? sanitizeString(githubProfile) : undefined,
        almaShineProfile: almaShineProfile ? sanitizeString(almaShineProfile) : undefined,
      },
    };

    // Remove undefined values
    Object.keys(updateData.professionalLinks).forEach(
      (key) =>
        updateData.professionalLinks[key] === undefined &&
        delete updateData.professionalLinks[key]
    );

    const student = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
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
      { new: true, runValidators: true }
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

    // Find student
    const student = await User.findOne({ studentId }).lean();
    if (!student) {
      return fail(res, 404, "Student not found");
    }

    // Check authorization
    if (req.user.role === "faculty" && student.department !== req.user.department) {
      return fail(res, 403, "You can only download resumes for students in your department");
    }

    // Check if resume exists
    if (!student.resume || !student.resume.resumeUrl) {
      return fail(res, 404, "No resume uploaded for this student");
    }

    const resumePath = student.resume.resumeUrl;

    // For now, return resume URL - in production, this would serve the file
    // If resumePath is a URL, redirect to it
    // If it's a local path, serve the file using res.download()

    if (resumePath.startsWith("http")) {
      // Redirect to URL
      return res.redirect(resumePath);
    } else {
      // Serve local file
      const path = require("path");
      const filePath = path.join(__dirname, "../../", resumePath);
      return res.download(filePath, `${student.name}_resume.pdf`);
    }
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
