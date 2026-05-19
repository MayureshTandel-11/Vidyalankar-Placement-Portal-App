const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const OpportunityTimeline = require("../models/OpportunityTimeline");
const Opportunity = require("../models/Opportunity");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const { getIO } = require("../utils/io");
const { canFacultyCollaborateOnOpportunity, canViewOpportunityAsAudience } = require("../utils/opportunityAccess");
const {
  isRoundSelectionComment,
  filterTimelineForRole,
  dedupeTimelineEntries,
} = require("../utils/timelineHelpers");
const { filterActiveStagesForStudent } = require("../utils/studentProgression");

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
    const { stage, comment, activateStage, studentId, studentIds } = req.body;  // FIX ISSUE 1: Added studentId and studentIds

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
    // FIX ISSUE 4: Defensive validation for non-Result stages
    // Prevent timeline entries for students not selected for current stage
    // ============================================
    // For non-Result stage-specific comments, validate student selection if studentId is provided
    if (studentId && stage !== "Result") {
      const stageIndex = RECRUITMENT_STAGE_ORDER.indexOf(stage);
      const studentIdStr = String(studentId).trim();

      // For first stage, all applicants are valid
      if (stageIndex > 0) {
        // For subsequent stages, verify student was selected in PREVIOUS stage
        const prevStage = RECRUITMENT_STAGE_ORDER[stageIndex - 1];
        const prevStageSelection = opportunity.stageManualSelections?.find(
          (s) => s.stage === prevStage && s.selectedStudentIds?.length > 0
        );

        if (!prevStageSelection?.selectedStudentIds?.some(
          (id) => String(id).trim() === studentIdStr
        )) {
          console.warn(
            `[TIMELINE DEFENSIVE CHECK] Student ${studentIdStr} not selected for ${stage} in previous stage. Allowing comment but flagging for review.`,
            { opportunityId, stage, studentId: studentIdStr }
          );
          // Note: We allow the comment but log a warning for audit
        }
      }
    }

    // ============================================
    // FIX ISSUE 1: Result Stage Per-Student Validation
    // ============================================
    // Result stage now allows ONE final comment PER STUDENT (not per opportunity)
    // Different students can each receive their own final result comment
    // But duplicate final comments for the SAME student should be blocked
    // ENHANCEMENT: Support both single studentId and batch studentIds for "Select All" feature
    if (stage === "Result") {
      // For Result stage, either studentId (single) or studentIds (array) is required
      if ((!studentId || !String(studentId).trim()) && (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: "studentId or studentIds is required for Result stage comments",
          code: "STUDENT_ID_REQUIRED"
        });
      }

      // Handle both single student and batch operations
      const studentIdsToProcess = studentIds && Array.isArray(studentIds) && studentIds.length > 0
        ? studentIds.map(id => String(id).trim())
        : [String(studentId).trim()];

      // Verify all students were actually selected for Result stage (i.e., selected in HR Interview)
      const prevStage = "HR Interview";
      const prevStageSelection = opportunity.stageManualSelections?.find(
        (s) => s.stage === prevStage && s.selectedStudentIds?.length > 0
      );

      for (const sid of studentIdsToProcess) {
        const wasSelectedForResult = prevStageSelection?.selectedStudentIds?.some(
          (id) => String(id).trim() === sid
        );

        if (!wasSelectedForResult) {
          return res.status(403).json({
            success: false,
            message: `Student ${sid} was not selected for Result stage. Only students selected in HR Interview can receive final result comments.`,
            code: "STUDENT_NOT_SELECTED_FOR_RESULT"
          });
        }

        // FIX ISSUE 1: Check for existing Result comment for THIS SPECIFIC STUDENT
        const existingResultComment = await OpportunityTimeline.findOne({
          opportunityId: opportunity._id,
          studentId: sid,
          stage: "Result",
        });

        if (existingResultComment) {
          return res.status(409).json({
            success: false,
            message: `Final result already posted for student ${sid}. Only one result comment is allowed per student.`,
            code: "RESULT_COMMENT_EXISTS_FOR_STUDENT"
          });
        }
      }

      // Batch insert all timeline entries for Result stage
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        const insertStartTime = Date.now();

        console.log("[TIMELINE BATCH INSERT] Starting batch insert", {
          opportunityId,
          stage,
          studentCount: studentIdsToProcess.length,
          studentIds: studentIdsToProcess,
          postedBy: req.user._id,
          timestamp: new Date().toISOString(),
        });

        const timelineEntries = studentIdsToProcess.map(sid => ({
          opportunityId: opportunity._id,
          studentId: sid,
          postedBy: req.user._id,
          role: req.user.role,
          stage,
          comment: comment.trim(),
          isStageActivation: false,
          type: "GENERAL",  // Result stage comments are general, not selection messages
        }));

        const insertedEntries = await OpportunityTimeline.insertMany(timelineEntries);
        const insertedIds = insertedEntries.map(entry => entry._id);

        console.log("[TIMELINE BATCH INSERT] Entries inserted successfully", {
          opportunityId,
          stage,
          insertCount: insertedEntries.length,
          insertedIds: insertedIds,
          insertDuration: Date.now() - insertStartTime,
        });

        // CRITICAL FIX: Add Result stage to activeStages if not already there
        // This ensures the Result stage appears in the selection process bar
        if (!opportunity.activeStages.includes("Result")) {
          await Opportunity.findByIdAndUpdate(opportunityId, { $addToSet: { activeStages: "Result" } });
        }

        // FIX: Fetch ONLY the newly created entries by their IDs (not by comment text which could include old entries)
        const createdEntries = await OpportunityTimeline.find({
          _id: { $in: insertedIds },
        }).populate("postedBy", "name role").lean();

        console.log("[TIMELINE BATCH FETCH] Fetched newly created entries", {
          opportunityId,
          stage,
          fetchedCount: createdEntries.length,
          fetchedIds: createdEntries.map(e => e._id),
        });

        // Get updated activeStages (now includes Result stage)
        const updatedOpportunity = await Opportunity.findById(opportunityId);

        // Emit Socket.IO events for each created entry
        const io = getIO();
        if (io && createdEntries.length > 0) {
          console.log("[TIMELINE SOCKET EMIT] Emitting socket events", {
            opportunityId,
            stage,
            entriesCount: createdEntries.length,
            room: `opportunity_${opportunityId}`,
          });

          for (const entry of createdEntries) {
            console.log(`[TIMELINE SOCKET EMIT] Emitting event for entry ${entry._id}`, {
              studentId: entry.studentId,
              stage: entry.stage,
            });

            io.to(`opportunity_${opportunityId}`).emit("timeline:new_entry", {
              entry,
              activeStages: updatedOpportunity.activeStages,
            });

            // Also emit analytics update event for the specific student
            // This allows StudentAnalytics component to refetch for this student
            io.emit("analytics:update", {
              studentId: entry.studentId,
              opportunityId: opportunityId,
              stage: stage,
              reason: "Timeline entry posted"
            });
          }
        }

        console.log("[TIMELINE BATCH COMPLETE] Response sent", {
          opportunityId,
          stage,
          entriesCount: createdEntries.length,
          totalDuration: Date.now() - insertStartTime,
        });

        return res.status(201).json({
          data: createdEntries,
          message: `Timeline entries created for ${createdEntries.length} students`
        });
      }
    }

    // Block faculty from posting round-selection congratulations via timeline POST.
    // Those entries are created only through manual-select after attendance submit.
    if (isRoundSelectionComment(comment.trim())) {
      return res.status(400).json({
        message:
          "Round selection congratulations are created automatically when students are manually selected after attendance submission.",
        code: "ROUND_SELECTION_USE_MANUAL_SELECT",
      });
    }

    const entryType = "GENERAL";
    const singleSubmitStartTime = Date.now();

    // FIX: For single-student Result submissions, check for duplicate BEFORE creating
    if (studentId && stage === "Result") {
      console.log("[TIMELINE SINGLE STUDENT RESULT] Checking for existing Result entry", {
        opportunityId,
        studentId: String(studentId).trim(),
        stage,
      });

      const existingTimeline = await OpportunityTimeline.findOne({
        opportunityId: opportunity._id,
        studentId: String(studentId).trim(),
        stage: "Result",
        type: "GENERAL",
      });

      if (existingTimeline) {
        console.log("[TIMELINE SINGLE STUDENT RESULT] Duplicate prevented - entry already exists", {
          opportunityId,
          studentId: String(studentId).trim(),
          stage,
          existingEntryId: existingTimeline._id,
        });
        return res.status(200).json({
          data: existingTimeline,
          message: "Duplicate timeline prevented - entry already exists",
        });
      }

      console.log("[TIMELINE SINGLE STUDENT RESULT] No duplicate found, proceeding with creation", {
        opportunityId,
        studentId: String(studentId).trim(),
        stage,
      });
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
      type: entryType,  // FIX: Include type field for better duplicate detection
    });

    try {
      console.log("[TIMELINE SAVE] Saving timeline entry", {
        opportunityId,
        stage,
        studentId: studentId ? String(studentId).trim() : null,
        timestamp: new Date().toISOString(),
      });

      await timelineEntry.save();

      console.log("[TIMELINE SAVE] Entry saved successfully", {
        entryId: timelineEntry._id,
        opportunityId,
        stage,
        studentId: studentId ? String(studentId).trim() : null,
      });
    } catch (saveErr) {
      // Handle duplicate key error (E11000) - entry already created by concurrent request
      if (saveErr.code === 11000) {
        console.warn("[TIMELINE DUPLICATE KEY] Concurrent duplicate prevented", {
          opportunityId,
          studentId: studentId ? String(studentId).trim() : null,
          stage,
          type: entryType,
          errorCode: saveErr.code,
          errorMessage: saveErr.message,
        });

        // Fetch and return the existing entry instead
        const existingEntry = await OpportunityTimeline.findOne({
          opportunityId: opportunity._id,
          studentId: studentId ? String(studentId).trim() : null,
          stage,
          type: entryType,
        }).populate("postedBy", "name role");

        if (existingEntry) {
          console.log("[TIMELINE DUPLICATE] Returning existing entry instead of throwing error", {
            existingEntryId: existingEntry._id,
            opportunityId,
            stage,
          });
          // Emit the existing entry via Socket.IO and return
          const io = getIO();
          if (io) {
            const updatedOpp = await Opportunity.findById(opportunityId);
            io.to(`opportunity_${opportunityId}`).emit("timeline:new_entry", {
              entry: existingEntry.toObject(),
              activeStages: updatedOpp.activeStages,
            });
          }
          return res.status(201).json({ data: existingEntry, message: "Timeline entry already exists" });
        } else {
          throw saveErr;
        }
      } else {
        throw saveErr;
      }
    }

    // If activateStage is true and stage is not already active, activate it
    if (activateStage && !opportunity.activeStages.includes(stage)) {
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

      // ONLY disable attendance execution during GENERAL UPDATE stage activation
      if (stage?.trim().toLowerCase() === "general update") {
        console.log(
          `[TIMELINE] Skipping attendance creation for General Update stage (opportunityId=${opportunity._id})`
        );
      } else if (applicants.length > 0) {
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

    // CRITICAL FIX: Ensure Result stage is added to activeStages
    // Result stage should always be active when a result comment is posted
    if (stage === "Result" && !opportunity.activeStages?.includes("Result")) {
      console.log("[TIMELINE RESULT] Adding Result to activeStages", { opportunityId });
      await Opportunity.findByIdAndUpdate(opportunityId, { $addToSet: { activeStages: "Result" } });
    }

    // Refetch the entry with proper population for socket emit
    const populatedEntry = await OpportunityTimeline.findById(timelineEntry._id)
      .populate("postedBy", "name role")
      .lean();

    console.log("[TIMELINE ENTRY FETCHED] Entry populated for emission", {
      entryId: populatedEntry._id,
      opportunityId,
      stage: populatedEntry.stage,
      studentId: populatedEntry.studentId || null,
    });

    // Get updated activeStages (now includes Result stage if it was just added)
    const updatedOpportunity = await Opportunity.findById(opportunityId);

    // Emit Socket.IO event with properly populated entry
    const io = getIO();
    if (io) {
      console.log('[TIMELINE SOCKET] Emitting timeline:new_entry event', {
        entryId: populatedEntry._id,
        room: `opportunity_${opportunityId}`,
        stage: populatedEntry.stage,
        studentId: populatedEntry.studentId || null,
      });

      io.to(`opportunity_${opportunityId}`).emit("timeline:new_entry", {
        entry: populatedEntry,
        activeStages: updatedOpportunity.activeStages,
      });

      // Also emit analytics update event if this entry is for a specific student
      if (populatedEntry.studentId) {
        console.log('[TIMELINE SOCKET] Emitting analytics:update event', {
          studentId: populatedEntry.studentId,
          opportunityId,
          stage: populatedEntry.stage,
        });

        io.emit("analytics:update", {
          studentId: populatedEntry.studentId,
          opportunityId: opportunityId,
          stage: populatedEntry.stage,
          reason: "Timeline entry posted"
        });
      }
    }

    console.log("[TIMELINE RESPONSE] Success response sent", {
      entryId: populatedEntry._id,
      opportunityId,
      stage: populatedEntry.stage,
      duration: Date.now() - singleSubmitStartTime,
    });

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

    let timeline = await OpportunityTimeline.find({
      opportunityId: opportunity._id,
    })
      .sort({ createdAt: 1 })
      .populate("postedBy", "name role")
      .lean();

    let attendanceRecords = [];
    if (req.user.role === "student" && req.user.studentId) {
      attendanceRecords = await OpportunityAttendance.find({
        opportunityId: opportunity._id,
        studentId: String(req.user.studentId).trim(),
      }).lean();
    }

    timeline = dedupeTimelineEntries(timeline);
    timeline = filterTimelineForRole(
      timeline,
      req.user.role,
      req.user.role === "student" ? req.user.studentId : null,
      opportunity.toObject ? opportunity.toObject() : opportunity,
      attendanceRecords
    );

    let activeStages = opportunity.activeStages || [];
    if (req.user.role === "student" && req.user.studentId) {
      activeStages = filterActiveStagesForStudent(
        activeStages,
        opportunity.toObject ? opportunity.toObject() : opportunity,
        req.user.studentId,
        attendanceRecords
      );
    }

    const responseData = {
      timeline: timeline || [],
      activeStages,
    };
    if (req.user.role === "student") {
      responseData.studentAttendance = attendanceRecords;
    }

    return res.status(200).json({
      data: responseData,
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
