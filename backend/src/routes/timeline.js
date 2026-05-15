const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const OpportunityTimeline = require("../models/OpportunityTimeline");
const Opportunity = require("../models/Opportunity");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const { getIO } = require("../utils/io");
const { canFacultyCollaborateOnOpportunity, canViewOpportunityAsAudience } = require("../utils/opportunityAccess");

const router = express.Router();

const RECRUITMENT_STAGE_ORDER = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

/**
 * CRITICAL FIX: For attendance list generation per stage
 *
 * RULE: Only students who are EXPLICITLY SELECTED for a stage should get attendance records
 * - Stage 0 (Aptitude Test): ALL applicants (first round)
 * - Stage 1+ (GD, TI, HR, Result): ONLY students manually selected in previous stage
 *
 * NO AUTO-INCLUSION: Students must NOT be auto-added to next round attendance
 * DEFENSIVE: Reject stages with no manual selection (except first stage)
 *
 * This prevents unselected/rejected students from appearing in next round attendance
 */
function applicantsForActivatedStage(opportunity, stage) {
  // Get all applicants who applied for this opportunity
  const applicants = (opportunity.applications || []).filter(
    (app) => app.studentId && String(app.studentId).trim()
  );

  // Find stage index in recruitment order
  const idx = RECRUITMENT_STAGE_ORDER.indexOf(stage);

  // STAGE 0 (Aptitude Test): Return all applicants for first round
  // This is the only case where automatic inclusion is correct
  if (idx <= 0) {
    console.log(`[ATTENDANCE FILTER][FIRST STAGE] Returning ${applicants.length} applicants for stage: ${stage}`);
    return applicants;
  }

  // STAGE 1+ (GD, TI, HR, Result): MUST have explicit manual selection from previous stage
  const prevStage = RECRUITMENT_STAGE_ORDER[idx - 1];
  const manual = opportunity.stageManualSelections?.find((s) => s.stage === prevStage);

  // DEFENSIVE CHECK: Verify manual selections exist for previous stage
  if (!manual || !manual.selectedStudentIds || manual.selectedStudentIds.length === 0) {
    console.warn(
      `[ATTENDANCE FILTER][VALIDATION] ⚠️  NO manual selections found for previous stage: ${prevStage}`,
      `Activating stage: ${stage}. This may be intentional (no students selected yet).`,
      `Returning ZERO applicants to prevent unselected students in attendance.`
    );
    // STRICT: Return empty array - do NOT auto-include students
    return [];
  }

  // Filter applicants to ONLY include those manually selected in previous stage
  const allowed = new Set(manual.selectedStudentIds.map((id) => String(id).trim()));
  const selectedApplicants = applicants.filter((app) =>
    allowed.has(String(app.studentId).trim())
  );

  console.log(
    `[ATTENDANCE FILTER][NEXT STAGE] For stage ${stage}:`,
    `- Previous stage (${prevStage}) manual selections: ${manual.selectedStudentIds.length}`,
    `- Filtered applicants: ${selectedApplicants.length}`,
    `- Prevented unselected: ${applicants.length - selectedApplicants.length}`
  );

  return selectedApplicants;
}

// POST /api/timeline/:opportunityId
// Faculty and Admin only - Create a new timeline entry
router.post("/:opportunityId", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { stage, comment, activateStage, studentId } = req.body;  // FIX ISSUE 1: Added studentId from request

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Validate input
    if (!stage || !comment?.trim()) {
      return res.status(400).json({ message: "Stage and comment are required" });
    }

    // Find the opportunity
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (req.user.role === "faculty" && !canFacultyCollaborateOnOpportunity(req.user, opportunity)) {
      return res.status(403).json({ message: "You don't have access to this opportunity" });
    }

    // ============================================
    // FIX ISSUE 1: Result Stage Per-Student Validation
    // ============================================
    // Result stage now allows ONE final comment PER STUDENT (not per opportunity)
    // Different students can each receive their own final result comment
    // But duplicate final comments for the SAME student should be blocked
    if (stage === "Result") {
      // For Result stage, studentId is required
      if (!studentId || !String(studentId).trim()) {
        return res.status(400).json({
          success: false,
          message: "studentId is required for Result stage comments",
          code: "STUDENT_ID_REQUIRED"
        });
      }

      // Verify student was actually selected for Result stage (i.e., selected in HR Interview)
      // Result stage is activated only for students selected in HR Interview
      const prevStage = "HR Interview";
      const prevStageSelection = opportunity.stageManualSelections?.find(
        (s) => s.stage === prevStage && s.selectedStudentIds?.length > 0
      );

      const studentIdStr = String(studentId).trim();
      const wasSelectedForResult = prevStageSelection?.selectedStudentIds?.some(
        (id) => String(id).trim() === studentIdStr
      );

      if (!wasSelectedForResult) {
        return res.status(403).json({
          success: false,
          message: "Student was not selected for Result stage. Only students selected in HR Interview can receive final result comments.",
          code: "STUDENT_NOT_SELECTED_FOR_RESULT"
        });
      }

      // FIX ISSUE 1: Check for existing Result comment for THIS SPECIFIC STUDENT
      // Changed from opportunity-level check to student-level check
      const existingResultComment = await OpportunityTimeline.findOne({
        opportunityId: opportunity._id,
        studentId: studentIdStr,  // FIX: Per-student check instead of opportunity-wide check
        stage: "Result",
      });

      if (existingResultComment) {
        return res.status(409).json({
          success: false,
          message: `Final result already posted for student ${studentIdStr}. Only one result comment is allowed per student.`,
          code: "RESULT_COMMENT_EXISTS_FOR_STUDENT"
        });
      }
    }

    // Create timeline entry
    const timelineEntry = new OpportunityTimeline({
      opportunityId: opportunity._id,
      studentId: studentId ? String(studentId).trim() : null,  // FIX ISSUE 1: Include studentId if provided
      postedBy: req.user._id,
      role: req.user.role,
      stage,
      comment: comment.trim(),
      isStageActivation: activateStage || false,
    });

    await timelineEntry.save();

    // If activateStage is true and stage is not already active, activate it
    if (activateStage && stage !== "General Update" && !opportunity.activeStages.includes(stage)) {
      // ===== STRICT VALIDATION: Non-first stages MUST have manual selection =====
      const stageIndex = RECRUITMENT_STAGE_ORDER.indexOf(stage);
      if (stageIndex > 0) {
        // This is a subsequent stage (not Aptitude Test)
        const prevStage = RECRUITMENT_STAGE_ORDER[stageIndex - 1];
        const hasManualSelection = opportunity.stageManualSelections?.find(
          (s) => s.stage === prevStage && s.selectedStudentIds?.length > 0
        );

        if (!hasManualSelection) {
          console.warn(
            `[TIMELINE VALIDATION][ERROR] Cannot activate stage without manual selection`,
            { opportunityId, currentStage: stage, previousStage: prevStage }
          );
          return res.status(400).json({
            message: `Cannot activate ${stage} without selecting students for ${prevStage} first.
                     Please manually select students for ${prevStage} before activating ${stage}.`,
            code: "MISSING_PREVIOUS_SELECTION"
          });
        }
      }

      // Add stage to activeStages using $addToSet to prevent duplicates
      await Opportunity.findByIdAndUpdate(opportunityId, { $addToSet: { activeStages: stage } });

      // CRITICAL: Get applicants (only selected ones for non-first stages)
      const applicants = applicantsForActivatedStage(opportunity, stage);

      if (applicants.length > 0) {
        const attendanceRecords = applicants.map((app) => ({
          opportunityId: opportunity._id,
          studentId: String(app.studentId).trim(),
          stage,
          status: "pending",
          markedBy: null,
          markedAt: null,
        }));

        // Insert with { ordered: false } to skip duplicates
        try {
          await OpportunityAttendance.insertMany(attendanceRecords, { ordered: false });
          console.log(
            `[TIMELINE] ✓ Created ${attendanceRecords.length} attendance records for stage: ${stage}`,
            { opportunityId, stageIndex, stageType: stageIndex === 0 ? "FIRST_ROUND" : "NEXT_ROUND" }
          );
        } catch (error) {
          // Duplicate errors (E11000) are expected and acceptable
          if (!error.message.includes("duplicate") && !error.message.includes("E11000")) {
            console.error("[TIMELINE ATTENDANCE ERROR]", { opportunityId, error: error.message });
            throw error;
          }
          console.log(`[TIMELINE] Skipped duplicate attendance records for stage: ${stage}`);
        }
      } else if (stageIndex > 0) {
        // For non-first stages, if NO applicants found, warn (this is likely an error)
        console.warn(
          `[TIMELINE WARNING] No applicants found for stage activation`,
          { opportunityId, stage, stageIndex, reason: "No manual selections from previous stage" }
        );
      }
    }

    // Refetch the entry with proper population for socket emit
    const populatedEntry = await OpportunityTimeline.findById(timelineEntry._id)
      .populate("postedBy", "name role")
      .lean();

    // Get updated activeStages
    const updatedOpportunity = await Opportunity.findById(opportunityId);

    // Emit Socket.IO event with properly populated entry
    const io = getIO();
    if (io) {
      console.log('[TIMELINE SOCKET] Emitting entry:', {
        _id: populatedEntry._id,
        postedBy: populatedEntry.postedBy,
        stage: populatedEntry.stage
      });
      io.to(`opportunity_${opportunityId}`).emit("timeline:new_entry", {
        entry: populatedEntry,
        activeStages: updatedOpportunity.activeStages,
      });
    }

    return res.status(201).json({ data: populatedEntry, message: "Timeline entry created" });
  } catch (error) {
    console.error("[TIMELINE POST ERROR]", {
      opportunityId: req.params.opportunityId,
      body: req.body,
      error: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    return res.status(500).json({ message: error.message || "Failed to create timeline entry" });
  }
});

// GET /api/timeline/:opportunityId
// All roles - fetch timeline entries for an opportunity
// Role-based filtering: Students see all entries, Faculty/Admin don't see student-specific congratulation messages
router.get("/:opportunityId", protect, async (req, res) => {
  try {
    const { opportunityId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID format" });
    }

    // Fetch opportunity first to get activeStages and validate it exists
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if ((req.user.role === "student" || req.user.role === "faculty") && !canViewOpportunityAsAudience(req.user, opportunity)) {
      return res.status(403).json({ message: "You don't have access to this opportunity timeline" });
    }

    // Fetch timeline entries
    let timeline = await OpportunityTimeline.find({
      opportunityId: opportunity._id,
    })
      .sort({ createdAt: 1 })
      .populate("postedBy", "name role")
      .lean();

    // ROLE-BASED FILTERING: Hide student-specific congratulation messages from faculty/admin
    // Students see all timeline entries
    // Faculty/Admin should NOT see student-specific messages (e.g., selection congratulations)
    if (req.user.role === "faculty" || req.user.role === "admin") {
      timeline = timeline.filter((entry) => {
        // Hide entries with student-specific congratulation messages
        // These are created when faculty/admin manually select students for next round
        const isStudentCongratulation =
          entry.comment &&
          entry.comment.includes("Congratulations! You have been selected for the next round");

        return !isStudentCongratulation;
      });
    }

    return res.status(200).json({
      data: {
        timeline: timeline || [],
        activeStages: opportunity.activeStages || [],
      },
      message: "Timeline fetched successfully",
    });
  } catch (error) {
    console.error("[TIMELINE GET ERROR]", {
      opportunityId: req.params.opportunityId,
      error: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }
    return res.status(500).json({ message: error.message || "Failed to fetch timeline" });
  }
});

module.exports = router;
