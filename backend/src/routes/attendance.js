const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const Opportunity = require("../models/Opportunity");
const { getIO } = require("../utils/io");
const { ok, fail } = require("../utils/apiResponse");
const { generateAttendanceCSV, generateAttendanceFilename } = require("../utils/csvExport");

const router = express.Router();

// ======================================
// HELPER: Check if stage is General Update
// ======================================
const isGeneralUpdate = (stage) => stage?.toLowerCase() === "general update";

// ======================================
// HELPER: Validate stage (reject General Update)
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

// GET /api/attendance/:opportunityId/:stage
// Faculty and Admin only - get attendance list for a specific stage
// Allows viewing both active stages (for editing) and closed/archived stages (for historical viewing)
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
    const attendanceList = attendanceRecords.map((record) => ({
      ...record,
      studentId: applicantMap[record.studentId] || {
        _id: record.studentId,
        name: "Unknown",
        studentId: record.studentId,
        email: "N/A",
        department: "N/A",
      },
    }));

    // Sort alphabetically by student name (A-Z)
    attendanceList.sort((a, b) =>
      (a.studentId?.name || "Unknown").localeCompare(b.studentId?.name || "Unknown", "en", { sensitivity: "base" })
    );

    return res.status(200).json({
      data: attendanceList || [],
      stageStatus,
      message: "Attendance list fetched successfully",
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
router.patch("/:opportunityId", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { studentId, stage, status } = req.body;

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

    // Validate input
    if (!studentId || !stage || !status) {
      return res.status(400).json({ message: "studentId, stage, and status are required" });
    }

    if (!["present", "absent"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'present' or 'absent'" });
    }

    // Check if attendance for this stage has been submitted
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

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
      { new: true }
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
router.post("/submit/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
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

    // Verify attendance has been submitted for this specific stage
    // This is the ONLY requirement - submission status, not stage activation status
    const stageStatus = opportunity.stageAttendanceStatus?.find((s) => s.stage === stage);
    if (!stageStatus?.isSubmitted) {
      return res.status(403).json({ message: "Attendance for this stage has not been submitted yet" });
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
    const enrichedRecords = attendanceRecords.map((record) => ({
      ...record.toObject?.() || record,
      studentId: applicantMap[record.studentId] || {
        _id: record.studentId,
        name: "Unknown",
        studentId: record.studentId,
        email: "N/A",
        department: "N/A",
      },
    }));

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
// This endpoint:
// 1. Marks attendance as submitted (if not already)
// 2. Stores selected students in stages tracking
// 3. Creates notifications for selected students
// 4. Updates student timeline
router.post("/select-next-round/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;
    const { selectedStudentIds = [] } = req.body;

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

    if (!Array.isArray(selectedStudentIds)) {
      return res.status(400).json({ message: "selectedStudentIds must be an array" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

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

    for (const studentId of selectedStudentIds) {
      try {
        // Find student user
        const student = await User.findOne({ studentId });
        if (student) {
          // Create notification
          const message = `Congratulations! You have been selected for ${nextStage} round.`;
          await Notification.create({
            studentId: student._id,
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            stage: nextStage,
            message,
            notificationType: "selection",
          });

          // Emit Socket.IO event for real-time notification
          const io = getIO();
          if (io) {
            io.to(`student_${student._id}`).emit("notification:new", {
              message,
              stage: nextStage,
              opportunityId,
              notificationType: "selection",
            });
          }

          // Create timeline entry
          await OpportunityTimeline.create({
            opportunityId: new mongoose.Types.ObjectId(opportunityId),
            postedBy: req.user._id,
            role: req.user.role,
            stage: nextStage,
            comment: `Student selected for ${nextStage}`,
            isStageActivation: false,
          });
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

module.exports = router;
