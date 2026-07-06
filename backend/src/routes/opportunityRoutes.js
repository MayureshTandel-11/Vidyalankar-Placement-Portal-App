const express = require("express");
const {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getActiveOpportunities,
  getArchivedOpportunities,
  applyToOpportunity,
  getApplicantsCount,
  getApplicants,
  downloadApplicants,
  downloadAllApplicantResumes,
  sendApplicantEmail,
  getOpportunityApplications,
  saveStageSelections,
  getStageSelections,
} = require("../controllers/opportunityController");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { validateOpportunityRequest } = require("../middleware/requestValidation");
const { emailUpload, handleEmailUploadError } = require("../middleware/emailUploadMiddleware");

const router = express.Router();

router.get("/active", protect, getActiveOpportunities);
router.get("/archive", protect, getArchivedOpportunities);
router.get("/", protect, listOpportunities);
router.get("/:id", protect, getOpportunityById);
router.post("/", protect, allowRoles("admin", "faculty"), validateOpportunityRequest, createOpportunity);
router.put("/:id", protect, allowRoles("admin", "faculty"), validateOpportunityRequest, updateOpportunity);
router.post("/:id/apply", protect, applyToOpportunity);
router.get("/:id/applicants/count", protect, allowRoles("admin", "faculty"), getApplicantsCount);
router.get("/:id/applicants/download", protect, allowRoles("admin", "faculty"), downloadApplicants);
router.get("/:id/applicants/resumes/download", protect, allowRoles("admin"), downloadAllApplicantResumes);
router.post(
  "/:id/applicants/email",
  protect,
  allowRoles("admin"),
  emailUpload.array("attachments", 10),
  handleEmailUploadError,
  sendApplicantEmail
);
router.get("/:id/applicants", protect, allowRoles("admin", "faculty"), getApplicants);
router.get("/:id/applications", protect, allowRoles("admin", "faculty"), getOpportunityApplications);

// Manual student selections for stages
router.post("/:opportunityId/stage/:stage/selections", protect, allowRoles("admin", "faculty"), saveStageSelections);
router.get("/:opportunityId/stage/:stage/selections", protect, allowRoles("admin", "faculty"), getStageSelections);

router.delete("/:id", protect, allowRoles("admin", "faculty"), deleteOpportunity);

module.exports = router;
