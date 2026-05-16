const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const Opportunity = require("../models/Opportunity");
const { getIO } = require("../utils/io");
const { ok, fail } = require("../utils/apiResponse");
const { generateAttendanceCSV, generateAttendanceFilename } = require("../utils/csvExport");
const { canFacultyCollaborateOnOpportunity } = require("../utils/opportunityAccess");
const {
  getRoundSelectionMessage,
  createRoundSelectionTimelineEntry,
  TIMELINE_BADGE_STAGE,
} = require("../utils/timelineHelpers");

const router = express.Router();

const blockFacultyWithoutOpportunityAccess = (req, res, opportunity) => {
  if (req.user.role === "faculty" && (!opportunity || !canFacultyCollaborateOnOpportunity(req.user, opportunity))) {
    res.status(403).json({ success: false, message: "You don't have access to this opportunity" });
    return true;
  }
  return false;
};

// ======================================
// HELPER: Check if stage is General Update
// ======================================
const isGeneralUpdate = (stage) => stage?.toLowerCase() === "general update";

// ======================================
// HELPER: Check if stage is Result stage
// ======================================
const isResultStage = (stage) => stage?.toLowerCase() === "result";

// ======================================
// HELPER: Validate stage (reject General Update and Result)
// ======================================
const validateStageNotGeneralUpdate = (stage) => {
  if (isGeneralUpdate(stage)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Attendance is not applicable for General Update stage"
      }
    };
  }
  return { isValid: true };
};

// ======================================
// HELPER: Validate stage for attendance operations
// Rejects both General Update and Result stage
// ======================================
const validateStageForAttendance = (stage) => {
  // Check for General Update
  if (isGeneralUpdate(stage)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Attendance is not applicable for General Update stage"
      }
    };
  }

  // Check for Result stage - NO attendance tracking for final result
  if (isResultStage(stage)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Attendance tracking is not applicable for the Result stage. Result stage only supports final declaration (Selected/Rejected)."
      }
    };
  }

  return { isValid: true };
};

// GET /api/attendance/:opportunityId/:stage
// Faculty and Admin only - get attendance list for a specific stage
// Allows viewing both active stages (for editing) and closed/archived stages (for historical viewing)
//
// CRITICAL FIX: Only returns attendance for explicitly selected students
// - First stage (Aptitude Test): Returns all applicants
// - Subsequent stages: ONLY returns students selected in previous stage
router.get("/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate stage is not General Update
    const stageValidation = validateStageNotGeneralUpdate(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Verify the opportunity exists
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Verify the stage has been registered (either active or historical)
    // Allow viewing any stage that has been activated at some point
    const isValidStage = opportunity.stageAttendanceStatus?.some((s) => s.stage === stage) || opportunity.activeStages.includes(stage);
    if (!isValidStage) {
      return res.status(403).json({ message: "Invalid stage for this opportunity" });
    }

    // Get submission status for this stage
    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage) || {
      stage,
      isSubmitted: false,
      submittedAt: null,
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
    };

    // ===== CRITICAL VALIDATION: Filter attendance based on selection status =====
    const RECRUITMENT_STAGE_ORDER = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview", "Result"];
    const stageIndex = RECRUITMENT_STAGE_ORDER.indexOf(stage);

    // For non-first stages, build filter to only include selected students
    let selectionFilterSet = null;
    if (stageIndex > 0) {
      // This is a subsequent stage - must check previous stage selections
      const prevStage = RECRUITMENT_STAGE_ORDER[stageIndex - 1];
      const manual = opportunity.stageManualSelections?.find((s) => s.stage === prevStage);

      if (manual?.selectedStudentIds?.length > 0) {
        // Only include selected students
        selectionFilterSet = new Set(manual.selectedStudentIds.map((id) => String(id).trim()));
      } else {
        // No selection in previous stage - return empty list
        console.warn(
          `[ATTENDANCE VALIDATION] No manual selection found for ${prevStage}`,
          `Returning empty attendance list for ${stage} to prevent unselected students`
        );
        return res.status(200).json({
          data: [],
          stageStatus,
          message: "No attendance records (no students selected for this stage)",
          validationNote: `Stage ${stage} has no selected applicants from ${prevStage}`,
        });
      }
    }

    // Fetch attendance records for this stage
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      stage,
    })
      .populate("markedBy", "name")
      .lean();

    // Create a map of studentId -> applicant info from opportunity.applications
    const applicantMap = {};
    if (opportunity.applications && Array.isArray(opportunity.applications)) {
      opportunity.applications.forEach((app) => {
        applicantMap[app.studentId] = {
          _id: app.studentId, // Use studentId as the ID
          name: app.studentName,
          studentId: app.studentId,
          email: app.studentEmail,
          department: app.studentDepartment,
        };
      });
    }

    // Combine attendance records with applicant information
    let attendanceList = attendanceRecords.map((record) => ({
      ...record,
      studentId: applicantMap[record.studentId] || {
        _id: record.studentId,
        name: "Unknown",
        studentId: record.studentId,
        email: "N/A",
        department: "N/A",
      },
    }));

    // ===== DEFENSIVE FILTERING: Remove unselected students for non-first stages =====
    if (selectionFilterSet && stageIndex > 0) {
      const originalCount = attendanceList.length;
      attendanceList = attendanceList.filter((record) =>
        selectionFilterSet.has(String(record.studentId?.studentId || record.studentId?._id || "").trim())
      );

      if (attendanceList.length < originalCount) {
        console.warn(
          `[ATTENDANCE FILTER] Removed unselected students from attendance list`,
          { stage, stageIndex, originalCount, filteredCount: attendanceList.length, removed: originalCount - attendanceList.length }
        );
      }
    }

    // Sort alphabetically by student name (A-Z)
    attendanceList.sort((a, b) =>
      (a.studentId?.name || "Unknown").localeCompare(b.studentId?.name || "Unknown", "en", { sensitivity: "base" })
    );

    return res.status(200).json({
      data: attendanceList || [],
      stageStatus,
      message: "Attendance list fetched successfully",
      stageMeta: { stageIndex, isFirstStage: stageIndex === 0 },
    });
  } catch (error) {
    console.error("[ATTENDANCE GET ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }
    return res.status(500).json({ message: error.message || "Failed to fetch attendance" });
  }
});

// PATCH /api/attendance/:opportunityId
// Faculty and Admin only - mark attendance for a student
// ⛔ NOT APPLICABLE FOR RESULT STAGE
router.patch("/:opportunityId", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { studentId, stage, status } = req.body;

    // Validate stage - reject both General Update AND Result stage
    const stageValidation = validateStageForAttendance(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Validate input
    if (!studentId || !stage || !status) {
      return res.status(400).json({ message: "studentId, stage, and status are required" });
    }

    if (!["present", "absent"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'present' or 'absent'" });
    }

    // Validate stage - reject both General Update AND Result stage
    // NOTE: stageValidation already validated above in this handler

    // Check if attendance for this stage has been submitted
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage);
    if (stageStatus?.isSubmitted) {
      return res.status(403).json({
        message: "Cannot modify attendance - this stage has already been submitted",
      });
    }

    // Find and update the attendance record (studentId is stored as string)
    const attendanceRecord = await OpportunityAttendance.findOneAndUpdate(
      {
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        studentId: String(studentId),
        stage,
      },
      {
        status,
        markedBy: req.user._id,
        markedAt: new Date(),
      },
      { returnDocument: "after" }
    );

    if (!attendanceRecord) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Emit Socket.IO event
    const io = getIO();
    if (io) {
      io.to(`opportunity_${opportunityId}`).emit("attendance:update", {
        studentId,
        stage,
        status,
        markedBy: req.user.name,
        markedAt: new Date(),
      });
    }

    return res.status(200).json({
      data: attendanceRecord,
      message: "Attendance marked successfully",
    });
  } catch (error) {
    console.error("[ATTENDANCE PATCH ERROR]", {
      opportunityId: req.params.opportunityId,
      body: req.body,
      error: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    return res.status(500).json({ message: error.message || "Failed to update attendance" });
  }
});

// GET /api/attendance/:opportunityId/student/:studentId
// Student (own record only), Faculty, Admin - get student's attendance across all stages
router.get("/:opportunityId/student/:studentId", protect, async (req, res) => {
  try {
    const { opportunityId, studentId } = req.params;

    // Enforce student can only access their own records
    if (req.user.role === "student" && String(req.user._id) !== studentId) {
      return res.status(403).json({ message: "Cannot access other student's records" });
    }

    // Fetch all attendance records for this student across all stages
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      studentId: new mongoose.Types.ObjectId(studentId),
    }).sort({ stage: 1 });

    return res.status(200).json({
      data: attendanceRecords,
      message: "Student attendance records fetched successfully",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[ATTENDANCE STUDENT GET ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch student attendance" });
  }
});

// POST /api/attendance/submit
// Faculty and Admin only - submit final attendance for a stage
// ⛔ NOT APPLICABLE FOR RESULT STAGE
router.post("/submit/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate stage - reject both General Update AND Result stage
    const stageValidation = validateStageForAttendance(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Verify stage is active
    if (!opportunity.activeStages.includes(stage)) {
      return res.status(403).json({ message: "Stage is not active" });
    }

    // Check if already submitted
    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage);
    if (stageStatus?.isSubmitted) {
      return res.status(400).json({ message: "Attendance for this stage has already been submitted" });
    }

    // Fetch all attendance records for this stage
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      stage,
    });

    if (attendanceRecords.length === 0) {
      return res.status(400).json({ message: "No attendance records found for this stage" });
    }

    // Calculate attendance statistics
    const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
    const absentCount = attendanceRecords.filter((a) => a.status === "absent").length;

    // Update attendance records to mark as submitted
    await OpportunityAttendance.updateMany(
      {
        opportunityId: new mongoose.Types.ObjectId(opportunityId),
        stage,
      },
      {
        isSubmitted: true,
        submittedAt: new Date(),
        submittedBy: req.user._id,
      }
    );

    // Update or create stage attendance status in Opportunity
    if (stageStatus) {
      // Update existing
      stageStatus.isSubmitted = true;
      stageStatus.submittedAt = new Date();
      stageStatus.submittedBy = req.user._id;
      stageStatus.totalRecords = attendanceRecords.length;
      stageStatus.presentCount = presentCount;
      stageStatus.absentCount = absentCount;
    } else {
      // Create new
      opportunity.stageAttendanceStatus.push({
        stage,
        isSubmitted: true,
        submittedAt: new Date(),
        submittedBy: req.user._id,
        totalRecords: attendanceRecords.length,
        presentCount,
        absentCount,
      });
    }

    await opportunity.save();

    // Emit Socket.IO event to notify clients
    const io = getIO();
    if (io) {
      io.to(`opportunity_${opportunityId}`).emit("attendance:submitted", {
        stage,
        submittedBy: req.user.name,
        submittedAt: new Date(),
        totalRecords: attendanceRecords.length,
        presentCount,
        absentCount,
      });
    }

    return res.status(200).json({
      data: {
        stage,
        isSubmitted: true,
        submittedAt: new Date(),
        totalRecords: attendanceRecords.length,
        presentCount,
        absentCount,
      },
      message: "Attendance submitted successfully",
    });
  } catch (error) {
    console.error("[ATTENDANCE SUBMIT ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID provided" });
    }

    return res.status(500).json({ message: error.message || "Failed to submit attendance" });
  }
});

// GET /api/attendance/download/:opportunityId/:stage
// Faculty and Admin only - download attendance as CSV
// Requirements:
// - Attendance must be submitted for this stage
// - Stage must have been activated at some point
// - Works for both active and closed stages
// - Only admin/faculty can download
// - General Update stage is not allowed
//
// CRITICAL: Only downloads attendance for explicitly selected students (except first stage)
router.get("/download/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate stage is not General Update
    const stageValidation = validateStageNotGeneralUpdate(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Verify attendance has been submitted for this specific stage
    // This is the ONLY requirement - submission status, not stage activation status
    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage);
    if (!stageStatus?.isSubmitted) {
      return res.status(403).json({ message: "Attendance for this stage has not been submitted yet" });
    }

    // ===== CRITICAL VALIDATION: Filter attendance based on selection status =====
    const RECRUITMENT_STAGE_ORDER = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview", "Result"];
    const stageIndex = RECRUITMENT_STAGE_ORDER.indexOf(stage);

    // For non-first stages, build filter to only include selected students
    let selectionFilterSet = null;
    if (stageIndex > 0) {
      // This is a subsequent stage - must check previous stage selections
      const prevStage = RECRUITMENT_STAGE_ORDER[stageIndex - 1];
      const manual = opportunity.stageManualSelections?.find((s) => s.stage === prevStage);

      if (manual?.selectedStudentIds?.length > 0) {
        // Only include selected students
        selectionFilterSet = new Set(manual.selectedStudentIds.map((id) => String(id).trim()));
      } else {
        // No selection in previous stage - return error
        return res.status(403).json({
          message: `Cannot download attendance for ${stage} - no students were selected for this stage from ${prevStage}`
        });
      }
    }

    // Fetch all attendance records for this stage
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      stage,
    }).populate("markedBy", "name");

    // Create a map of studentId -> applicant info
    const applicantMap = {};
    if (opportunity.applications && Array.isArray(opportunity.applications)) {
      opportunity.applications.forEach((app) => {
        applicantMap[app.studentId] = {
          _id: app.studentId,
          name: app.studentName,
          studentId: app.studentId,
          email: app.studentEmail,
          department: app.studentDepartment,
        };
      });
    }

    // Enrich attendance records with applicant info
    let enrichedRecords = attendanceRecords.map((record) => ({
      ...record.toObject?.() || record,
      studentId: applicantMap[record.studentId] || {
        _id: record.studentId,
        name: "Unknown",
        studentId: record.studentId,
        email: "N/A",
        department: "N/A",
      },
    }));

    // ===== DEFENSIVE FILTERING: Remove unselected students for non-first stages =====
    if (selectionFilterSet && stageIndex > 0) {
      const originalCount = enrichedRecords.length;
      enrichedRecords = enrichedRecords.filter((record) =>
        selectionFilterSet.has(String(record.studentId?.studentId || record.studentId?._id || "").trim())
      );

      if (enrichedRecords.length < originalCount) {
        console.warn(
          `[ATTENDANCE DOWNLOAD FILTER] Removed unselected students from CSV`,
          { stage, stageIndex, originalCount, filteredCount: enrichedRecords.length, removed: originalCount - enrichedRecords.length }
        );
      }
    }

    // Sort by student name
    enrichedRecords.sort((a, b) =>
      (a.studentId?.name || "").localeCompare(b.studentId?.name || "")
    );

    // Generate CSV with metadata
    const csvContent = generateAttendanceCSV(enrichedRecords, {
      includeDateColumns: true,
      includeMarkedBy: true,
      includeSummary: true,
      includeFacultyInfo: true,
      stageStatus,
    });

    // Generate filename
    const filename = generateAttendanceFilename(opportunity.announcementHeading, stage);

    // Set response headers for file download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Send CSV content
    return res.send(csvContent);
  } catch (error) {
    console.error("[ATTENDANCE DOWNLOAD ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    return res.status(500).json({ message: error.message || "Failed to download attendance" });
  }
});

// POST /api/attendance/select-next-round/:opportunityId/:stage
// Faculty and Admin only - select students for next round
// ⛔ NOT APPLICABLE FOR RESULT STAGE
// This endpoint:
// 1. Marks attendance as submitted (if not already)
// 2. Stores selected students in stages tracking
// 3. Creates notifications for selected students
// 4. Updates student timeline
router.post("/select-next-round/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;
    const { selectedStudentIds = [] } = req.body;

    // Validate stage - reject both General Update AND Result stage
    const stageValidation = validateStageForAttendance(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    if (!Array.isArray(selectedStudentIds)) {
      return res.status(400).json({ message: "selectedStudentIds must be an array" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Map stage name to schema field name
    const stageMapping = {
      "Aptitude Test": "aptitude",
      "Group Discussion": "groupDiscussion",
      "Technical Interview": "technicalInterview",
      "HR Interview": "hrInterview",
    };

    const stageField = stageMapping[stage];
    if (!stageField) {
      return res.status(400).json({ message: "Invalid stage for selection" });
    }

    // Fetch attendance records to get attended students
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      stage,
    });

    const attendedStudentIds = attendanceRecords.map(a => a.studentId);

    // Update stages tracking in Opportunity
    if (!opportunity.stages) {
      opportunity.stages = {};
    }

    if (!opportunity.stages[stageField]) {
      opportunity.stages[stageField] = {
        attendedStudents: [],
        selectedStudents: [],
      };
    }

    opportunity.stages[stageField].attendedStudents = attendedStudentIds;
    opportunity.stages[stageField].selectedStudents = selectedStudentIds;

    await opportunity.save();

    // Create notifications for selected students
    const { createNotification } = require("../controllers/notificationController");
    const User = require("../models/User");
    const OpportunityTimeline = require("../models/OpportunityTimeline");
    const Notification = require("../models/Notification");

    // Determine next stage for notification
    const stageOrder = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview"];
    const currentStageIndex = stageOrder.indexOf(stage);
    const nextStage = currentStageIndex < stageOrder.length - 1 ? stageOrder[currentStageIndex + 1] : "Result";

    // FIX ISSUE 2: Create attendance map for status validation
    // Prevents absent/pending students from receiving timeline updates
    const attendanceMap = {};
    attendanceRecords.forEach((record) => {
      attendanceMap[record.studentId] = record.status;
    });

    for (const studentId of selectedStudentIds) {
      try {
        // FIX ISSUE 4: Verify student has "present" status before creating timeline/notification
        // CRITICAL: Blocks timeline updates for absent/pending students
        const attendanceStatus = attendanceMap[studentId];
        if (attendanceStatus !== "present") {
          console.warn(
            `[SELECT NEXT ROUND SKIP] Student ${studentId} has status '${attendanceStatus}', skipping notification.`,
            `Only students marked 'present' can advance. Prevented from receiving timeline update.`,
            { opportunityId, stage, studentId, actualStatus: attendanceStatus }
          );
          continue; // Skip notification for non-present students - ISSUE 4 FIX
        }

        // Find student user
        const student = await User.findOne({ studentId });
        if (student) {
          const message = getRoundSelectionMessage(stage);

          const existingNotification = await Notification.findOne({
            studentId: student._id,
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            notificationType: "selection",
            message,
          });

          if (existingNotification) {
            continue;
          }

          try {
          await Notification.create({
            studentId: student._id,
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            stage: TIMELINE_BADGE_STAGE,
            message,
            notificationType: "selection",
          });
          } catch (notifErr) {
            if (notifErr.code !== 11000) {
              console.error(`[NOTIFICATION ERROR for student ${studentId}]`, notifErr);
            }
            continue;
          }

          // Emit Socket.IO event for real-time notification
          const io = getIO();
          if (io) {
            io.to(`student_${student._id}`).emit("notification:new", {
              message,
              stage: TIMELINE_BADGE_STAGE,
              opportunityId,
              notificationType: "selection",
            });
          }

          // NOTE: Timeline creation is NOT handled here
          // All timeline entries for congratulations are created ONLY in manual-select route
          // This ensures single source of truth for timeline creation
        }
      } catch (err) {
        console.error(`[NOTIFICATION ERROR for student ${studentId}]`, err);
        // Continue processing other students even if one fails
      }
    }

    // Emit Socket.IO event
    const io = getIO();
    if (io) {
      io.to(`opportunity_${opportunityId}`).emit("selection:completed", {
        stage,
        selectedCount: selectedStudentIds.length,
        completedBy: req.user.name,
        completedAt: new Date(),
      });
    }

    return res.status(200).json({
      data: {
        stage,
        attendedStudents: attendedStudentIds,
        selectedStudents: selectedStudentIds,
        notificationsCreated: selectedStudentIds.length,
      },
      message: `Selected ${selectedStudentIds.length} students for next round`,
    });
  } catch (error) {
    console.error("[SELECT NEXT ROUND ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({ message: error.message || "Failed to select students for next round" });
  }
});

// POST /api/attendance/manual-select/:opportunityId/:stage
// Faculty and Admin only - manually select students after attendance submission
// ⛔ NOT APPLICABLE FOR RESULT STAGE
// Requirements:
// - Attendance must be submitted for this stage
// - Cannot select absent students
// - Cannot select duplicate students
router.post("/manual-select/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;
    const { selectedStudentIds = [] } = req.body;

    // Validate stage - reject both General Update AND Result stage
    const stageValidation = validateStageForAttendance(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message,
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    if (!Array.isArray(selectedStudentIds)) {
      return res.status(400).json({ message: "selectedStudentIds must be an array" });
    }

    if (selectedStudentIds.length === 0) {
      return res.status(400).json({ message: "At least one student must be selected" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Check if attendance has been submitted for this stage
    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage);
    if (!stageStatus?.isSubmitted) {
      return res.status(403).json({
        message: "Attendance must be submitted before manual selection",
      });
    }

    // Fetch attendance records for this stage to validate selections
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      stage,
    });

    // Create a map of attendance by studentId
    const attendanceMap = {};
    attendanceRecords.forEach((record) => {
      attendanceMap[record.studentId] = record.status;
    });

    // Only students marked present may be manually selected
    const invalidSelections = selectedStudentIds.filter(
      (studentId) => attendanceMap[studentId] !== "present"
    );

    if (invalidSelections.length > 0) {
      return res.status(400).json({
        message: `Only students marked present can be selected. Invalid: ${invalidSelections.join(", ")}`,
      });
    }

    // Check for duplicates
    const uniqueSelections = new Set(selectedStudentIds);
    if (uniqueSelections.size !== selectedStudentIds.length) {
      return res.status(400).json({
        message: "Duplicate student selections found",
      });
    }

    const normalizeIds = (ids) =>
      [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))].sort();
    const nextList = normalizeIds(selectedStudentIds);

    const existingSelection = opportunity.stageManualSelections?.find((s) => s.stage === stage);
    const prevSig = existingSelection?.selectedStudentIds?.length
      ? normalizeIds(existingSelection.selectedStudentIds).join(",")
      : "";
    const newSig = nextList.join(",");
    // FIX: Detect duplicate selection even on first call
    // If the selection hasn't changed from existing selection, return 409
    if (prevSig === newSig) {
      return res.status(409).json({
        success: false,
        message: "This selection was already saved",
      });
    }

    const prevNotifySet = new Set(
      (existingSelection?.selectedStudentIds || []).map((x) => String(x).trim())
    );
    const studentsToNotify = nextList.filter((id) => !prevNotifySet.has(id));

    // DEBUG: Log studentsToNotify to check for duplicates
    console.log(
      `[MANUAL SELECT] Calculating studentsToNotify:`,
      { stage, nextList, prevSelected: existingSelection?.selectedStudentIds, studentsToNotify, uniqueCount: new Set(studentsToNotify).size }
    );

    // SAFETY: Deduplicate studentsToNotify to ensure no student appears twice
    const uniqueStudentsToNotify = [...new Set(studentsToNotify)];
    if (uniqueStudentsToNotify.length !== studentsToNotify.length) {
      console.warn(
        `[MANUAL SELECT WARNING] studentsToNotify contained duplicates! Original: ${studentsToNotify.length}, Unique: ${uniqueStudentsToNotify.length}`,
        { original: studentsToNotify, unique: uniqueStudentsToNotify }
      );
    }

    const stageOrder = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview"];
    const currentStageIndex = stageOrder.indexOf(stage);
    const nextRoundName =
      currentStageIndex >= 0 && currentStageIndex < stageOrder.length - 1
        ? stageOrder[currentStageIndex + 1]
        : "Result";
    const companyName = opportunity.announcementHeading || "Placement opportunity";

    let manualSelection = existingSelection;
    if (manualSelection) {
      manualSelection.selectedStudentIds = nextList;
      manualSelection.selectedAt = new Date();
      manualSelection.selectedBy = req.user._id;
      manualSelection.nextRoundName = nextRoundName;
      manualSelection.companyName = companyName;
    } else {
      opportunity.stageManualSelections.push({
        stage,
        selectedStudentIds: nextList,
        nextRoundName,
        companyName,
        selectedAt: new Date(),
        selectedBy: req.user._id,
      });
    }

    await opportunity.save();

    const User = require("../models/User");
    const Notification = require("../models/Notification");
    const OpportunityTimeline = require("../models/OpportunityTimeline");

    // FIX: Collect all created timeline entries for socket emission
    const createdTimelineEntries = [];

    for (const sid of uniqueStudentsToNotify) {
      try {
        const studentUser = await User.findOne({ studentId: sid });
        if (!studentUser) continue;

        // Verify student has SELECTED status before creating timeline
        // Students must be marked present (attended the stage) to be eligible for selection
        const attendanceRecord = attendanceMap[sid];
        if (attendanceRecord !== "present") {
          console.warn(
            `[MANUAL SELECT TIMELINE SKIP] Student ${sid} has status '${attendanceRecord}', not 'present'. Skipping timeline creation.`,
            { opportunityId, stage, studentId: sid }
          );
          continue; // Skip timeline creation for non-present students
        }

        const message = getRoundSelectionMessage(stage);

        // FIX: Check if notification already exists before creating
        // Prevents duplicate notifications from concurrent requests or retries
        const existingNotification = await Notification.findOne({
          studentId: studentUser._id,
          opportunityId: new mongoose.Types.ObjectId(opportunityId),
          notificationType: "selection",
          message,
        });

        if (!existingNotification) {
          try {
            await Notification.create({
              studentId: studentUser._id,
              opportunityId: new mongoose.Types.ObjectId(opportunityId),
              stage: TIMELINE_BADGE_STAGE,
              message,
              notificationType: "selection",
            });
          } catch (notifErr) {
            // Handle duplicate key error (E11000) - notification already created by concurrent request
            if (notifErr.code === 11000) {
              console.log("[NOTIFICATION DUPLICATE PREVENTED]", { studentId: sid, stage: nextRoundName });
            } else {
              console.error("[NOTIFICATION ERROR]", notifErr);
            }
          }
        }

        // Emit Socket.IO event for real-time notification
        const io = getIO();
        if (io) {
          io.to(`student_${studentUser._id}`).emit("notification:new", {
            message,
            stage: TIMELINE_BADGE_STAGE,
            opportunityId,
            notificationType: "selection",
          });
        }

        const normalizedStudentId = String(sid).trim();
        const { entry: timelineEntry, created: timelineCreated } =
          await createRoundSelectionTimelineEntry({
            OpportunityTimeline,
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            studentId: normalizedStudentId,
            sourceStage: stage,
            postedBy: req.user._id,
            role: req.user.role,
          });

        if (timelineCreated) {
          console.log(
            `[MANUAL SELECT TIMELINE ✓] Created congratulations entry`,
            {
              opportunityId,
              sourceStage: stage,
              studentId: normalizedStudentId,
              entryId: timelineEntry._id,
            }
          );
          createdTimelineEntries.push(timelineEntry);
        } else {
          console.log(
            "[DUPLICATE BLOCKED] Timeline entry already exists for this student and round",
            {
              opportunityId,
              sourceStage: stage,
              studentId: normalizedStudentId,
              existingId: timelineEntry._id,
            }
          );
        }
      } catch (inner) {
        console.error("[MANUAL SELECT NOTIFY]", inner);
      }
    }

    // FIX: Emit socket events for each created timeline entry
    // This ensures the frontend timeline component receives the congratulation messages in real-time
    const io = getIO();
    if (io && createdTimelineEntries.length > 0) {
      for (const entry of createdTimelineEntries) {
        const populatedEntry = await entry.populate("postedBy", "name role");
        io.to(`opportunity_${opportunityId}`).emit("timeline:new_entry", {
          entry: populatedEntry,
          activeStages: opportunity.activeStages || [],
        });
      }
      console.log(
        `[MANUAL SELECT SOCKET] Emitted ${createdTimelineEntries.length} timeline entries via socket`,
        { opportunityId, stage }
      );
    }

    const ioFinal = getIO();
    if (ioFinal) {
      ioFinal.to(`opportunity_${opportunityId}`).emit("manual:selection:updated", {
        stage,
        selectedCount: nextList.length,
        selectedBy: req.user.name,
        selectedAt: new Date(),
      });
    }

    return ok(res, {
      stage,
      selectedStudentIds: nextList,
      selectedAt: new Date(),
      nextRoundName,
      companyName,
    });
  } catch (error) {
    console.error("[MANUAL SELECT ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID provided" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }

    return res.status(500).json({ message: error.message || "Failed to save manual selections" });
  }
});

// GET /api/attendance/manual-selections/:opportunityId/:stage
// Faculty and Admin only - fetch manually selected students for a stage
router.get("/manual-selections/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate stage is not General Update
    const stageValidation = validateStageNotGeneralUpdate(stage);
    if (!stageValidation.isValid) {
      return res.status(stageValidation.error.status).json({
        success: false,
        message: stageValidation.error.message,
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    if (blockFacultyWithoutOpportunityAccess(req, res, opportunity)) return;

    // Get manual selections for this stage
    const manualSelection = opportunity.stageManualSelections?.find((s) => s.stage === stage);

    if (!manualSelection) {
      return res.status(200).json({
        data: {
          stage,
          selectedStudentIds: [],
          selectedAt: null,
          selectedBy: null,
        },
        message: "No manual selections found for this stage",
      });
    }

    // Fetch attendance status for selected students
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      studentId: { $in: manualSelection.selectedStudentIds },
      stage,
    });

    // Create a map of studentId -> attendance info
    const attendanceMap = {};
    attendanceRecords.forEach((record) => {
      attendanceMap[record.studentId] = {
        status: record.status,
        markedBy: record.markedBy,
        markedAt: record.markedAt,
      };
    });

    // Enrich selection with student details from applications
    const applicantMap = {};
    if (opportunity.applications && Array.isArray(opportunity.applications)) {
      opportunity.applications.forEach((app) => {
        applicantMap[app.studentId] = {
          _id: app.studentId,
          name: app.studentName,
          studentId: app.studentId,
          email: app.studentEmail,
          department: app.studentDepartment,
        };
      });
    }

    const selectedStudentsDetails = manualSelection.selectedStudentIds.map((studentId) => ({
      studentId,
      name: applicantMap[studentId]?.name || "Unknown",
      email: applicantMap[studentId]?.email || "N/A",
      department: applicantMap[studentId]?.department || "N/A",
      attendance: attendanceMap[studentId] || { status: "N/A" },
    }));

    return res.status(200).json({
      data: {
        stage,
        selectedStudentIds: manualSelection.selectedStudentIds,
        selectedStudentsDetails,
        selectedAt: manualSelection.selectedAt,
        selectedBy: manualSelection.selectedBy,
      },
      message: "Manual selections fetched successfully",
    });
  } catch (error) {
    console.error("[MANUAL SELECTIONS GET ERROR]", {
      opportunityId: req.params.opportunityId,
      stage: req.params.stage,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    return res.status(500).json({ message: error.message || "Failed to fetch manual selections" });
  }
});

module.exports = router;
