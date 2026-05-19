const User = require("../models/User");
const Opportunity = require("../models/Opportunity");
const OpportunityAttendance = require("../models/OpportunityAttendance");
const mongoose = require("mongoose");
const { sanitizeString } = require("../utils/sanitize");
const { isValidDepartment } = require("../constants/departments");

/**
 * Get analytics for a student
 * GET /api/student/analytics/:studentId
 * Shows:
 * - Total opportunities applied
 * - List of applied opportunities with progress
 * - Stages cleared
 * - Current status
 */
const getStudentAnalytics = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate input - defensive check to prevent /analytics/null
    if (!studentId || studentId === "null" || String(studentId).trim() === "") {
      console.warn("[ANALYTICS] Invalid studentId parameter:", studentId);
      return res.status(400).json({ message: "Invalid student ID" });
    }

    // Find student
    const student = await User.findOne({ studentId }).lean();
    if (!student) {
      console.warn("[ANALYTICS] Student not found:", studentId);
      return res.status(404).json({ message: "Student not found" });
    }

    // Check authorization (faculty can only view their department students)
    if (req.user.role === "faculty" && student.department !== req.user.department) {
      console.warn("[ANALYTICS] Unauthorized faculty access:", { faculty: req.user.email, student: student.email });
      return res.status(403).json({ message: "You can only view analytics for students in your department" });
    }

    // Get all opportunities the student applied for
    const appliedOpportunities = await Opportunity.find({
      "applications.studentId": studentId,
    })
      .select("_id announcementHeading type department lastDate status stageManualSelections")
      .lean();

    // For each opportunity, get the student's progress through stages
    const opportunitiesWithProgress = await Promise.all(
      appliedOpportunities.map(async (opp) => {
        // Get attendance records for this student in this opportunity
        const attendanceRecords = await OpportunityAttendance.find({
          opportunityId: opp._id,
          studentId,
        }).lean();

        // ===== CRITICAL VALIDATION: Filter stages based on selection status =====
        // For stage N, student must have been selected in stage N-1
        // Get manual selections to determine eligible stages
        const stageManualSelections = opp.stageManualSelections || [];
        const STAGE_ORDER = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview", "Result"];

        // Determine which stages student is eligible for
        const eligibleStages = new Set(["Aptitude Test"]); // Always eligible for first stage
        for (let i = 1; i < STAGE_ORDER.length; i++) {
          const prevStage = STAGE_ORDER[i - 1];
          const prevSelection = stageManualSelections.find((s) => s.stage === prevStage);
          if (prevSelection?.selectedStudentIds?.includes(studentId)) {
            eligibleStages.add(STAGE_ORDER[i]);
          }
        }

        // Map stages to progress (only show eligible stages)
        const stageProgress = {};
        const stages = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview"];

        for (const stage of stages) {
          // Only process if eligible for this stage
          if (eligibleStages.has(stage)) {
            const record = attendanceRecords.find((r) => r.stage === stage);
            if (record) {
              stageProgress[stage] = record.status; // present, absent, or pending
            } else {
              stageProgress[stage] = "not-attended"; // Not reached yet
            }
          } else {
            // Not eligible for this stage (wasn't selected in previous round)
            stageProgress[stage] = "not-eligible";
          }
        }

        // Check result (only if eligible)
        const resultRecord = attendanceRecords.find((r) => r.stage === "Result");
        if (resultRecord && eligibleStages.has("Result")) {
          stageProgress.Result = resultRecord.status;
        } else if (eligibleStages.has("Result")) {
          stageProgress.Result = "not-attended";
        } else {
          stageProgress.Result = "not-eligible";
        }

        // Determine highest stage reached (only among eligible stages)
        let highestStageCleared = "Applied";
        for (const stage of stages) {
          if (eligibleStages.has(stage)) {
            if (stageProgress[stage] === "present") {
              highestStageCleared = stage;
            } else if (stageProgress[stage] === "absent") {
              highestStageCleared = `Rejected in ${stage}`;
              break;
            }
          }
        }

        return {
          opportunityId: opp._id,
          title: opp.announcementHeading,
          type: opp.type,
          department: opp.department,
          status: opp.status,
          appliedDate: opp.lastDate,
          stageProgress,
          highestStageCleared,
          eligibleStagesCount: eligibleStages.size,
        };
      })
    );

    // Calculate overall statistics
    const totalApplied = appliedOpportunities.length;
    const totalClearedAptitude = opportunitiesWithProgress.filter(
      (o) => o.stageProgress["Aptitude Test"] === "present"
    ).length;
    const totalClearedGD = opportunitiesWithProgress.filter(
      (o) => o.stageProgress["Group Discussion"] === "present"
    ).length;
    const totalClearedTechnical = opportunitiesWithProgress.filter(
      (o) => o.stageProgress["Technical Interview"] === "present"
    ).length;
    const totalClearedHR = opportunitiesWithProgress.filter(
      (o) => o.stageProgress["HR Interview"] === "present"
    ).length;
    const totalRejected = opportunitiesWithProgress.filter(
      (o) => o.highestStageCleared.includes("Rejected")
    ).length;

    return res.status(200).json({
      data: {
        student: {
          name: student.name,
          email: student.email,
          studentId: student.studentId,
          department: student.department,
          year: student.year,
        },
        statistics: {
          totalApplied,
          totalClearedAptitude,
          totalClearedGD,
          totalClearedTechnical,
          totalClearedHR,
          totalRejected,
        },
        opportunities: opportunitiesWithProgress,
      },
      message: "Analytics fetched successfully",
    });
  } catch (error) {
    console.error("[GET STUDENT ANALYTICS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch analytics" });
  }
};

/**
 * Get opportunity details for a student
 * Shows attendance status and rounds cleared/rejected
 * GET /api/student/analytics/opportunity/:opportunityId/:studentId
 *
 * CRITICAL: Only shows stages student is eligible for (i.e., selected in previous round)
 */
const getOpportunityAnalytics = async (req, res) => {
  try {
    const { opportunityId, studentId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(opportunityId)) {
      return res.status(400).json({ message: "Invalid opportunity ID" });
    }

    // Get opportunity
    const opportunity = await Opportunity.findById(opportunityId).lean();
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    // Check authorization for faculty
    if (req.user.role === "faculty") {
      const student = await User.findOne({ studentId }).lean();
      if (student && student.department !== req.user.department) {
        return res.status(403).json({ message: "You can only view analytics for students in your department" });
      }
    }

    // Get all attendance records for this student
    const attendanceRecords = await OpportunityAttendance.find({
      opportunityId: new mongoose.Types.ObjectId(opportunityId),
      studentId,
    }).lean();

    // ===== CRITICAL VALIDATION: Determine eligible stages =====
    // Student is only eligible for stages where they were selected in previous round
    const stageManualSelections = opportunity.stageManualSelections || [];
    const STAGE_ORDER = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview", "Result"];

    const eligibleStages = new Set(["Aptitude Test"]); // Always eligible for first stage
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      const prevStage = STAGE_ORDER[i - 1];
      const prevSelection = stageManualSelections.find((s) => s.stage === prevStage);
      if (prevSelection?.selectedStudentIds?.includes(studentId)) {
        eligibleStages.add(STAGE_ORDER[i]);
      }
    }

    // Build stage progress (only for eligible stages)
    const stageProgress = [];
    const stages = ["Aptitude Test", "Group Discussion", "Technical Interview", "HR Interview", "Result"];

    for (const stage of stages) {
      if (eligibleStages.has(stage)) {
        const record = attendanceRecords.find((r) => r.stage === stage);
        stageProgress.push({
          stage,
          status: record ? record.status : "not-attended",
          markedAt: record ? record.markedAt : null,
          eligible: true,
        });
      } else {
        // Not eligible - show as not-eligible instead of not-attended
        stageProgress.push({
          stage,
          status: "not-eligible",
          markedAt: null,
          eligible: false,
          reason: "Not selected in previous round",
        });
      }
    }

    // Find rejection round if any (only among eligible stages)
    let rejectionRound = null;
    for (const record of attendanceRecords) {
      if (record.status === "absent" && eligibleStages.has(record.stage)) {
        rejectionRound = record.stage;
        break;
      }
    }

    return res.status(200).json({
      data: {
        opportunity: {
          id: opportunity._id,
          title: opportunity.announcementHeading,
          department: opportunity.department,
          status: opportunity.status,
        },
        stageProgress,
        rejectionRound,
        eligibleStagesCount: eligibleStages.size,
      },
      message: "Opportunity analytics fetched successfully",
    });
  } catch (error) {
    console.error("[GET OPPORTUNITY ANALYTICS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch opportunity analytics" });
  }
};

/**
 * Get class analytics
 * GET /api/student/analytics/class
 * Faculty/Admin only
 * Shows stats for all students in department/overall
 */
const getClassAnalytics = async (req, res) => {
  try {
    const { department: deptParam, year: yearParam, search: searchParam } = req.query;

    // Build query based on role
    let departmentQuery = {};
    if (req.user.role === "faculty") {
      departmentQuery = { department: req.user.department };
    } else if (req.user.role === "admin" && deptParam && isValidDepartment(sanitizeString(deptParam))) {
      departmentQuery = { department: sanitizeString(deptParam) };
    }

    const yearFilter =
      yearParam && ["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(yearParam) ? { year: yearParam } : {};

    const searchQ = searchParam ? sanitizeString(searchParam) : "";
    const searchFilter = searchQ
      ? {
          $or: [
            { fullName: { $regex: searchQ, $options: "i" } },
            { name: { $regex: searchQ, $options: "i" } },
            { email: { $regex: searchQ, $options: "i" } },
            { studentId: { $regex: searchQ, $options: "i" } },
          ],
        }
      : {};

    // Get all students in department/class
    const students = await User.find({
      role: "student",
      ...departmentQuery,
      ...yearFilter,
      ...searchFilter,
    })
      .select("_id studentId name fullName email year department")
      .sort({ fullName: 1, name: 1 })
      .lean();

    if (students.length === 0) {
      return res.status(200).json({
        data: {
          totalStudents: 0,
          averageOpportunitiesApplied: "0.00",
          averageMaxStageReached: "0.00",
          topPerformers: [],
          students: [],
          stageMapping: {
            1: "Aptitude Test",
            2: "Group Discussion",
            3: "Technical Interview",
            4: "HR Interview",
            5: "Result",
          },
        },
        message: "No students found",
      });
    }

    // Calculate statistics for each student
    const studentStats = await Promise.all(
      students.map(async (student) => {
        // Get opportunities applied
        const appliedOpps = await Opportunity.find({
          "applications.studentId": student.studentId,
        }).countDocuments();

        // Get max stage reached
        const allAttendance = await OpportunityAttendance.find({
          studentId: student.studentId,
        }).lean();

        let maxStage = 0;
        const stageMap = {
          "Aptitude Test": 1,
          "Group Discussion": 2,
          "Technical Interview": 3,
          "HR Interview": 4,
          "Result": 5,
        };

        for (const record of allAttendance) {
          if (record.status === "present" && stageMap[record.stage]) {
            maxStage = Math.max(maxStage, stageMap[record.stage]);
          }
        }

        return {
          studentId: student.studentId,
          name: student.fullName || student.name,
          opportunitiesApplied: appliedOpps,
          maxStageReached: maxStage,
        };
      })
    );

    // Calculate aggregates
    const totalOppApplied = studentStats.reduce((sum, s) => sum + s.opportunitiesApplied, 0);
    const avgOppApplied = totalOppApplied / students.length;
    const avgStageReached = studentStats.reduce((sum, s) => sum + s.maxStageReached, 0) / students.length;

    const topPerformers = [...studentStats]
      .sort((a, b) => b.maxStageReached - a.maxStageReached || b.opportunitiesApplied - a.opportunitiesApplied)
      .slice(0, 5)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" }));

    const studentList = students
      .map((s) => ({
        _id: s._id,
        studentId: s.studentId,
        name: s.fullName || s.name,
        email: s.email,
        year: s.year,
        department: s.department,
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" }));

    return res.status(200).json({
      data: {
        totalStudents: students.length,
        averageOpportunitiesApplied: avgOppApplied.toFixed(2),
        averageMaxStageReached: avgStageReached.toFixed(2),
        topPerformers,
        students: studentList,
        stageMapping: {
          1: "Aptitude Test",
          2: "Group Discussion",
          3: "Technical Interview",
          4: "HR Interview",
          5: "Result",
        },
      },
      message: "Class analytics fetched successfully",
    });
  } catch (error) {
    console.error("[GET CLASS ANALYTICS ERROR]", error);
    return res.status(500).json({ message: error.message || "Failed to fetch class analytics" });
  }
};

module.exports = {
  getStudentAnalytics,
  getOpportunityAnalytics,
  getClassAnalytics,
};
