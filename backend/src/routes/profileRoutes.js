const express = require("express");
const {
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
  uploadStudentPhoto,
  updateProfessionalLinks,
  updateStudentId,
  downloadResume,
  downloadStudentPhoto,
} = require("../controllers/profileController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { upload, handleUploadError, validateFileUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

// GET /api/student/profile - Get full student profile
router.get("/profile", protect, allowRoles("student"), getStudentProfile);

// POST /api/student/academic-info - Update academic information
router.post(
  "/academic-info",
  protect,
  allowRoles("student"),
  updateAcademicInfo
);

// POST /api/student/technical-skills - Update technical skills
router.post(
  "/technical-skills",
  protect,
  allowRoles("student"),
  updateTechnicalSkills
);

// POST /api/student/certification - Add new certification
router.post(
  "/certification",
  protect,
  allowRoles("student"),
  addCertification
);

// PATCH /api/student/certification/:certificationId - Update certification
router.patch(
  "/certification/:certificationId",
  protect,
  allowRoles("student"),
  updateCertification
);

// DELETE /api/student/certification/:certificationId - Delete certification
router.delete(
  "/certification/:certificationId",
  protect,
  allowRoles("student"),
  (req, res, next) => {
    req.body.certificationId = req.params.certificationId;
    next();
  },
  deleteCertification
);

// POST /api/student/project - Add new project
router.post("/project", protect, allowRoles("student"), addProject);

// PATCH /api/student/project/:projectId - Update project
router.patch(
  "/project/:projectId",
  protect,
  allowRoles("student"),
  (req, res, next) => {
    req.body.projectId = req.params.projectId;
    next();
  },
  updateProject
);

// DELETE /api/student/project/:projectId - Delete project
router.delete(
  "/project/:projectId",
  protect,
  allowRoles("student"),
  (req, res, next) => {
    req.body.projectId = req.params.projectId;
    next();
  },
  deleteProject
);

// POST /api/student/resume - Upload resume (PDF)
router.post(
  "/resume",
  protect,
  allowRoles("student"),
  upload.single("resume"),
  handleUploadError,
  validateFileUpload,
  uploadResume
);

// PUT /api/student/upload-photo — Profile photo (JSON base64)
router.put("/upload-photo", protect, allowRoles("student"), uploadStudentPhoto);

// POST /api/student/professional-links - Update professional links
router.post(
  "/professional-links",
  protect,
  allowRoles("student"),
  updateProfessionalLinks
);

// POST /api/student/student-id - Update student ID
router.post(
  "/student-id",
  protect,
  allowRoles("student"),
  updateStudentId
);

// GET /api/student/resume/download/:studentId - Download student resume
// Faculty can download only from their department
// Admin can download any student's resume
router.get(
  "/resume/download/:studentId",
  protect,
  allowRoles("faculty", "admin"),
  downloadResume
);

// GET /api/student/download-photo/:studentId — Download student profile photo
router.get(
  "/download-photo/:studentId",
  protect,
  allowRoles("faculty", "admin"),
  downloadStudentPhoto
);

// Legacy path (some clients called /profile/resume/download/...)
router.get(
  "/profile/resume/download/:studentId",
  protect,
  allowRoles("faculty", "admin"),
  downloadResume
);

module.exports = router;
