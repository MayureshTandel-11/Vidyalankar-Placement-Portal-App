const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { protect } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  uploadOfferLetter,
  handleOfferLetterUploadError,
} = require("../middleware/offerLetterUploadMiddleware");
const OfferLetter = require("../models/OfferLetter");
const Opportunity = require("../models/Opportunity");
const User = require("../models/User");
const { ok, fail } = require("../utils/apiResponse");

const router = express.Router();

// Helper: Check if faculty can collaborate on opportunity
const canFacultyCollaborateOnOpportunity = (user, opportunity) => {
  if (!user || !opportunity) return false;
  if (user.role === "admin") return true;
  if (user.role !== "faculty") return false;
  return opportunity.department === user.department;
};

/**
 * GET /api/offerLetters/selected-students/:opportunityId
 * Fetch students marked as "Selected" or "HR Cleared" in Result stage
 * Used to show eligible students for offer letter upload
 * Only admin/faculty can access
 */
router.get(
  "/selected-students/:opportunityId",
  protect,
  allowRoles("faculty", "admin"),
  async (req, res) => {
    try {
      const { opportunityId } = req.params;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      // Fetch opportunity
      const opportunity = await Opportunity.findById(opportunityId);
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      // Faculty access control
      if (!canFacultyCollaborateOnOpportunity(req.user, opportunity)) {
        return res.status(403).json({
          success: false,
          message: "You don't have access to this opportunity",
        });
      }

      // Get students marked as selected in HR Interview or Result stage
      const hrStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "HR Interview"
      );
      const resultStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "Result"
      );

      // Combine selected students from both stages (Result takes priority)
      const selectedStudentIds = new Set([
        ...(hrStage?.selectedStudentIds || []),
        ...(resultStage?.selectedStudentIds || []),
      ]);

      if (selectedStudentIds.size === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: "No selected students found",
        });
      }

      // Get student details from applications
      const selectedStudents = opportunity.applications
        ?.filter((app) => selectedStudentIds.has(app.studentId))
        .map((app) => ({
          studentId: app.studentId,
          name: app.studentName,
          email: app.studentEmail,
          department: app.studentDepartment,
          phone: app.studentPhone || "N/A",
        })) || [];

      // Get existing offer letters for these students
      const existingOffers = await OfferLetter.find({
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId: { $in: Array.from(selectedStudentIds) },
      }).lean();

      const offerMap = new Map(
        existingOffers.map((o) => [o.studentId, o])
      );

      // Attach offer letter status to each student
      const studentsList = selectedStudents.map((student) => ({
        ...student,
        hasOfferLetter: !!offerMap.get(student.studentId),
        offerLetterInfo: offerMap.get(student.studentId) || null,
      }));

      return res.status(200).json({
        success: true,
        data: studentsList,
        message: `Found ${studentsList.length} selected students`,
      });
    } catch (error) {
      console.error("[GET SELECTED STUDENTS ERROR]", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch selected students",
      });
    }
  }
);

/**
 * POST /api/offerLetters/upload/:opportunityId/:studentId
 * Upload offer letter PDF for a specific student
 * Only admin/faculty can upload
 * Replaces existing offer letter if present
 */
router.post(
  "/upload/:opportunityId/:studentId",
  protect,
  allowRoles("faculty", "admin"),
  uploadOfferLetter.single("file"),
  handleOfferLetterUploadError,
  async (req, res) => {
    try {
      const { opportunityId, studentId } = req.params;

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      if (!studentId || studentId.trim() === "") {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid student ID",
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Fetch and validate opportunity
      const opportunity = await Opportunity.findById(opportunityId);
      if (!opportunity) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      // Faculty access control
      if (!canFacultyCollaborateOnOpportunity(req.user, opportunity)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({
          success: false,
          message: "You don't have access to this opportunity",
        });
      }

      // Verify student is in selected list
      const selectedStudentIds = new Set([
        ...(opportunity.stageManualSelections?.find(
          (s) => s.stage === "HR Interview"
        )?.selectedStudentIds || []),
        ...(opportunity.stageManualSelections?.find(
          (s) => s.stage === "Result"
        )?.selectedStudentIds || []),
      ]);

      if (!selectedStudentIds.has(studentId)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({
          success: false,
          message: "Student is not in the selected list for this opportunity",
        });
      }

      // Delete existing offer letter if present
      const existingOffer = await OfferLetter.findOne({
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId,
      });

      if (existingOffer) {
        const oldPath = existingOffer.filePath;
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            console.warn("[DELETE OLD OFFER LETTER] File deletion failed", err);
          }
        }
      }

      // Create or update offer letter record
      const offerLetter = await OfferLetter.findOneAndUpdate(
        {
          opportunityId: new mongoose.Types.ObjectId(opportunityId),
          studentId,
        },
        {
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        },
        { upsert: true, returnDocument: "after", lean: true }
      );

      return res.status(201).json({
        success: true,
        data: {
          offerId: offerLetter._id,
          studentId: offerLetter.studentId,
          fileName: offerLetter.fileName,
          uploadedAt: offerLetter.uploadedAt,
          uploadedBy: req.user.name,
        },
        message: "Offer letter uploaded successfully",
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("[FILE CLEANUP ERROR]", err);
        }
      }

      console.error("[UPLOAD OFFER LETTER ERROR]", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to upload offer letter",
      });
    }
  }
);

/**
 * GET /api/offerLetters/download/:opportunityId
 * Student downloads their own offer letter
 * Only the specific student can download if they have "Selected" or "Placed" status
 * Security: Validates student ownership + status eligibility
 */
router.get(
  "/download/:opportunityId",
  protect,
  async (req, res) => {
    try {
      const { opportunityId } = req.params;
      const studentId = req.user.studentId;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      // Fetch opportunity to check student's selection status
      const opportunity = await Opportunity.findById(opportunityId).lean();
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      // Check if student is in HR Interview or Result stage selections (Selected/Placed status)
      const hrStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "HR Interview"
      );
      const resultStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "Result"
      );

      const isInHRSelection = hrStage?.selectedStudentIds?.includes(studentId);
      const isInResultSelection = resultStage?.selectedStudentIds?.includes(studentId);

      // Student must be in either HR Interview or Result selection to download
      if (!isInHRSelection && !isInResultSelection) {
        return res.status(403).json({
          success: false,
          message: "You are not eligible to download an offer letter for this opportunity. Only selected students can download.",
        });
      }

      // Find offer letter
      const offerLetter = await OfferLetter.findOne({
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId,
      }).lean();

      if (!offerLetter) {
        return res.status(404).json({
          success: false,
          message: "Offer letter not found for your profile",
        });
      }

      // Verify file exists
      if (!fs.existsSync(offerLetter.filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found on server",
        });
      }

      console.log(
        `[OFFER LETTER DOWNLOAD] Student ${studentId} downloaded offer letter for opportunity ${opportunityId}`
      );

      // Send file
      res.download(
        offerLetter.filePath,
        `${studentId}_offer_letter.pdf`,
        (err) => {
          if (err) {
            console.error("[DOWNLOAD ERROR]", err);
            if (!res.headersSent) {
              res.status(500).json({
                success: false,
                message: "Failed to download file",
              });
            }
          }
        }
      );
    } catch (error) {
      console.error("[GET OFFER LETTER ERROR]", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to download offer letter",
      });
    }
  }
);

/**
 * GET /api/offerLetters/check/:opportunityId
 * Check if current student has an offer letter for an opportunity
 * Also returns student's eligibility status (Selected/Placed/Not Eligible)
 */
router.get(
  "/check/:opportunityId",
  protect,
  async (req, res) => {
    try {
      const { opportunityId } = req.params;
      const studentId = req.user.studentId;

      if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      // Fetch opportunity to check selection status
      const opportunity = await Opportunity.findById(opportunityId).lean();
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      // Determine student's status based on stage selections
      const hrStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "HR Interview"
      );
      const resultStage = opportunity.stageManualSelections?.find(
        (s) => s.stage === "Result"
      );

      const isInHRSelection = hrStage?.selectedStudentIds?.includes(studentId);
      const isInResultSelection = resultStage?.selectedStudentIds?.includes(studentId);

      let studentStatus = "Not Eligible"; // Default: not selected
      if (isInResultSelection) {
        studentStatus = "HR Cleared"; // or "Placed" if offer letter exists
      } else if (isInHRSelection) {
        studentStatus = "Selected";
      }

      // Check if offer letter exists
      const offerLetter = await OfferLetter.findOne({
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId,
      })
        .select("fileName uploadedAt")
        .lean();

      // If offer letter exists and student was in selection, they are "Placed"
      if (offerLetter && (isInHRSelection || isInResultSelection)) {
        studentStatus = "Placed";
      }

      // Student can only download if they are Selected or Placed
      const canDownload = isInHRSelection || isInResultSelection;

      return res.status(200).json({
        success: true,
        data: {
          hasOfferLetter: !!offerLetter,
          offerLetterInfo: offerLetter || null,
          studentStatus: studentStatus, // "Selected", "Placed", "HR Cleared", or "Not Eligible"
          canDownload: canDownload, // Boolean: true if student is eligible to see download button
        },
      });
    } catch (error) {
      console.error("[CHECK OFFER LETTER ERROR]", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to check offer letter",
      });
    }
  }
);

/**
 * DELETE /api/offerLetters/:opportunityId/:studentId
 * Delete offer letter (admin/faculty only)
 */
router.delete(
  "/:opportunityId/:studentId",
  protect,
  allowRoles("faculty", "admin"),
  async (req, res) => {
    try {
      const { opportunityId, studentId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      // Verify access
      const opportunity = await Opportunity.findById(opportunityId);
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      if (!canFacultyCollaborateOnOpportunity(req.user, opportunity)) {
        return res.status(403).json({
          success: false,
          message: "You don't have access to this opportunity",
        });
      }

      // Find and delete offer letter
      const offerLetter = await OfferLetter.findOneAndDelete({
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId,
      });

      if (!offerLetter) {
        return res.status(404).json({
          success: false,
          message: "Offer letter not found",
        });
      }

      // Delete file
      if (offerLetter.filePath && fs.existsSync(offerLetter.filePath)) {
        try {
          fs.unlinkSync(offerLetter.filePath);
        } catch (err) {
          console.warn("[FILE DELETION WARNING]", err);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Offer letter deleted successfully",
      });
    } catch (error) {
      console.error("[DELETE OFFER LETTER ERROR]", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete offer letter",
      });
    }
  }
);

module.exports = router;
