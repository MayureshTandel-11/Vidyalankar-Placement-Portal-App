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

// GET /api/attendance/:opportunityId/:stage
// Faculty and Admin only - get attendance list for a specific stage
router.get("/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Verify the opportunity exists and stage is active
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (!opportunity.activeStages.includes(stage)) {
      return res.status(403).json({ message: "Stage not yet activated for this opportunity" });
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
router.get("/download/:opportunityId/:stage", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId, stage } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Fetch opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
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

    // Generate CSV
    const csvContent = generateAttendanceCSV(enrichedRecords, {
      includeDateColumns: true,
      includeMarkedBy: true,
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

module.exports = router;
