const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const OpportunityTimeline = require("../models/OpportunityTimeline");
const Opportunity = require("../models/Opportunity");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const { getIO } = require("../utils/io");
const { ok, fail } = require("../utils/apiResponse");

const router = express.Router();

const RECRUITMENT_STAGE_ORDER = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

/** After manual selection for the previous round, only those students get attendance rows for the new stage. */
function applicantsForActivatedStage(opportunity, stage) {
  const applicants = (opportunity.applications || []).filter(
    (app) => app.studentId && String(app.studentId).trim()
  );
  const idx = RECRUITMENT_STAGE_ORDER.indexOf(stage);
  if (idx <= 0) return applicants;

  const prevStage = RECRUITMENT_STAGE_ORDER[idx - 1];
  const manual = opportunity.stageManualSelections?.find((s) => s.stage === prevStage);
  if (manual?.selectedStudentIds?.length) {
    const allowed = new Set(manual.selectedStudentIds.map((id) => String(id).trim()));
    return applicants.filter((app) => allowed.has(String(app.studentId).trim()));
  }
  return applicants;
}

// POST /api/timeline/:opportunityId
// Faculty and Admin only - Create a new timeline entry
router.post("/:opportunityId", protect, allowRoles("faculty", "admin"), async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { stage, comment, activateStage } = req.body;

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

    // Create timeline entry
    const timelineEntry = new OpportunityTimeline({
      opportunityId: opportunity._id,
      postedBy: req.user._id,
      role: req.user.role,
      stage,
      comment: comment.trim(),
      isStageActivation: activateStage || false,
    });

    await timelineEntry.save();

    // If activateStage is true and stage is not already active, activate it
    if (activateStage && stage !== "General Update" && !opportunity.activeStages.includes(stage)) {
      // Add stage to activeStages using $addToSet to prevent duplicates
      await Opportunity.findByIdAndUpdate(opportunityId, { $addToSet: { activeStages: stage } });

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
          console.log(`[TIMELINE] Created ${attendanceRecords.length} attendance records for opportunity ${opportunityId}`);
        } catch (error) {
          // Duplicate errors (E11000) are expected and acceptable
          if (!error.message.includes("duplicate") && !error.message.includes("E11000")) {
            console.error("[TIMELINE ATTENDANCE ERROR]", { opportunityId, error: error.message });
            throw error;
          }
          console.log(`[TIMELINE] Skipped ${attendanceRecords.length} potential duplicate attendance records`);
        }
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

    // Fetch timeline entries
    const timeline = await OpportunityTimeline.find({
      opportunityId: opportunity._id,
    })
      .sort({ createdAt: 1 })
      .populate("postedBy", "name role")
      .lean();

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
