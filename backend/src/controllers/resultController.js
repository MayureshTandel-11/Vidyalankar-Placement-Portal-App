const Opportunity = require("../models/Opportunity");
const OfferLetter = require("../models/OfferLetter");
const { ok, fail } = require("../utils/apiResponse");
const { canFacultyCollaborateOnOpportunity } = require("../utils/opportunityAccess");
const path = require("path");
const fs = require("fs");

/**
 * Get students with result status (Selected/HR Cleared/Placed) for an opportunity
 * GET /api/results/:opportunityId
 */
const getResultStudents = async (req, res) => {
  try {
    const { opportunityId } = req.params;

    // Validate opportunity exists and user has access
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return fail(res, 404, "Opportunity not found");
    }

    // Check access: only admin or collaborating faculty
    if (req.user.role === "faculty" && !canFacultyCollaborateOnOpportunity(req.user, opportunity)) {
      return fail(res, 403, "Access denied. You cannot view results for this opportunity");
    }

    // Get manual selections for HR Interview and Result stages
    const hrInterviewSelection = opportunity.stageManualSelections?.find(
      (s) => s.stage === "HR Interview"
    );
    const resultSelection = opportunity.stageManualSelections?.find(
      (s) => s.stage === "Result"
    );

    const hrSelectedIds = new Set(hrInterviewSelection?.selectedStudentIds || []);
    const resultSelectedIds = new Set(resultSelection?.selectedStudentIds || []);

    // Get all offer letters for this opportunity
    const offerLetters = await OfferLetter.find({ opportunityId });
    const placedStudentIds = new Set(offerLetters.map((ol) => ol.studentId));

    // Build result students list with status
    const resultStudents = [];

    // Add students from HR Interview selection (Status: Selected)
    for (const studentId of hrSelectedIds) {
      const application = opportunity.applications.find(
        (app) => app.studentId === studentId
      );
      if (application) {
        const offerLetter = offerLetters.find(
          (ol) => ol.studentId === studentId
        );
        resultStudents.push({
          studentId,
          studentName: application.studentName,
          studentEmail: application.studentEmail,
          studentDepartment: application.studentDepartment,
          studentYear: application.studentYear,
          status: placedStudentIds.has(studentId)
            ? "Placed"
            : resultSelectedIds.has(studentId)
            ? "HR Cleared"
            : "Selected",
          offerLetterId: offerLetter?._id || null,
          offerLetterFileName: offerLetter?.fileName || null,
          applicationId: application._id,
        });
      }
    }

    // Add students from Result selection who aren't already in the list (Status: HR Cleared)
    for (const studentId of resultSelectedIds) {
      if (!hrSelectedIds.has(studentId)) {
        const application = opportunity.applications.find(
          (app) => app.studentId === studentId
        );
        if (application) {
          const offerLetter = offerLetters.find(
            (ol) => ol.studentId === studentId
          );
          resultStudents.push({
            studentId,
            studentName: application.studentName,
            studentEmail: application.studentEmail,
            studentDepartment: application.studentDepartment,
            studentYear: application.studentYear,
            status: placedStudentIds.has(studentId) ? "Placed" : "HR Cleared",
            offerLetterId: offerLetter?._id || null,
            offerLetterFileName: offerLetter?.fileName || null,
            applicationId: application._id,
          });
        }
      }
    }

    // Add students with offer letters who aren't already in the list (Status: Placed)
    for (const studentId of placedStudentIds) {
      if (
        !hrSelectedIds.has(studentId) &&
        !resultSelectedIds.has(studentId)
      ) {
        const application = opportunity.applications.find(
          (app) => app.studentId === studentId
        );
        if (application) {
          const offerLetter = offerLetters.find(
            (ol) => ol.studentId === studentId
          );
          resultStudents.push({
            studentId,
            studentName: application.studentName,
            studentEmail: application.studentEmail,
            studentDepartment: application.studentDepartment,
            studentYear: application.studentYear,
            status: "Placed",
            offerLetterId: offerLetter?._id || null,
            offerLetterFileName: offerLetter?.fileName || null,
            applicationId: application._id,
          });
        }
      }
    }

    console.log(
      `[RESULT CONTROLLER] Retrieved ${resultStudents.length} result students for opportunity ${opportunityId}`
    );

    return ok(res, {
      resultStudents,
      count: resultStudents.length,
      opportunityId,
    });
  } catch (error) {
    console.error("[RESULT CONTROLLER ERROR]", error);
    return fail(res, 500, "Failed to fetch result students", error.message);
  }
};

/**
 * Upload offer letter for a student
 * POST /api/results/upload-offer-letter
 */
const uploadOfferLetter = async (req, res) => {
  try {
    const { opportunityId, studentId } = req.body;

    // Validate input
    if (!opportunityId || !studentId) {
      return fail(res, 400, "opportunityId and studentId are required");
    }

    if (!req.file) {
      return fail(res, 400, "No file uploaded");
    }

    // Validate file is PDF
    const fileExt = path.extname(req.file.filename).toLowerCase();
    if (fileExt !== ".pdf") {
      // Delete the uploaded file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete non-PDF file:", err);
      });
      return fail(res, 400, "Only PDF files are allowed");
    }

    // Verify opportunity exists and user has access
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete file:", err);
      });
      return fail(res, 404, "Opportunity not found");
    }

    // Check access: only admin or collaborating faculty
    if (
      req.user.role === "faculty" &&
      !canFacultyCollaborateOnOpportunity(req.user, opportunity)
    ) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete file:", err);
      });
      return fail(res, 403, "Access denied. You cannot upload for this opportunity");
    }

    // Verify student has applied to this opportunity
    const studentApplication = opportunity.applications.find(
      (app) => app.studentId === studentId
    );
    if (!studentApplication) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete file:", err);
      });
      return fail(res, 404, "Student has not applied to this opportunity");
    }

    // Check if student is in Result section (Selected/HR Cleared/Placed)
    const hrInterviewSelection = opportunity.stageManualSelections?.find(
      (s) => s.stage === "HR Interview"
    );
    const resultSelection = opportunity.stageManualSelections?.find(
      (s) => s.stage === "Result"
    );

    const isSelected =
      hrInterviewSelection?.selectedStudentIds?.includes(studentId) ||
      resultSelection?.selectedStudentIds?.includes(studentId);

    if (!isSelected) {
      const existingOffer = await OfferLetter.findOne({
        opportunityId,
        studentId,
      });
      if (!existingOffer) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("[RESULT UPLOAD] Failed to delete file:", err);
        });
        return fail(
          res,
          403,
          "Student is not in the result selection for this opportunity"
        );
      }
    }

    // Delete old offer letter if exists
    const existingOfferLetter = await OfferLetter.findOne({
      opportunityId,
      studentId,
    });

    if (existingOfferLetter) {
      const oldFilePath = existingOfferLetter.filePath;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete old file:", err);
      });
    }

    // Create or update offer letter record
    const offerLetterData = {
      opportunityId,
      studentId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    let offerLetter;
    if (existingOfferLetter) {
      offerLetter = await OfferLetter.findByIdAndUpdate(
        existingOfferLetter._id,
        offerLetterData,
        { new: true }
      );
    } else {
      offerLetter = new OfferLetter(offerLetterData);
      await offerLetter.save();
    }

    console.log(
      `[RESULT UPLOAD] Offer letter uploaded: ${offerLetter._id} for student ${studentId} opportunity ${opportunityId}`
    );

    return ok(res, {
      message: "Offer letter uploaded successfully",
      offerLetter: {
        _id: offerLetter._id,
        fileName: offerLetter.fileName,
        uploadedAt: offerLetter.uploadedAt,
      },
    });
  } catch (error) {
    // Try to delete file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[RESULT UPLOAD] Failed to delete file on error:", err);
      });
    }
    console.error("[RESULT UPLOAD ERROR]", error);
    return fail(res, 500, "Failed to upload offer letter", error.message);
  }
};

/**
 * Download offer letter
 * GET /api/results/download/:offerId
 */
const downloadOfferLetter = async (req, res) => {
  try {
    const { offerId } = req.params;

    // Find offer letter
    const offerLetter = await OfferLetter.findById(offerId);
    if (!offerLetter) {
      return fail(res, 404, "Offer letter not found");
    }

    // Authorization: admin, faculty collaborator, or the student themselves
    const isAdmin = req.user.role === "admin";
    const isStudent =
      req.user.role === "student" &&
      req.user.studentId === offerLetter.studentId;

    if (!isAdmin && !isStudent) {
      // Check if faculty can access
      const opportunity = await Opportunity.findById(
        offerLetter.opportunityId
      );
      if (
        !opportunity ||
        !canFacultyCollaborateOnOpportunity(req.user, opportunity)
      ) {
        return fail(res, 403, "Access denied. You cannot download this offer letter");
      }
    }

    // Check file exists
    if (!fs.existsSync(offerLetter.filePath)) {
      return fail(res, 404, "File not found on server");
    }

    console.log(
      `[RESULT DOWNLOAD] Offer letter downloaded: ${offerId} by user ${req.user._id}`
    );

    // Send file
    res.download(offerLetter.filePath, offerLetter.fileName, (err) => {
      if (err) {
        console.error("[RESULT DOWNLOAD ERROR]", err);
      }
    });
  } catch (error) {
    console.error("[RESULT DOWNLOAD ERROR]", error);
    return fail(res, 500, "Failed to download offer letter", error.message);
  }
};

module.exports = {
  getResultStudents,
  uploadOfferLetter,
  downloadOfferLetter,
};
