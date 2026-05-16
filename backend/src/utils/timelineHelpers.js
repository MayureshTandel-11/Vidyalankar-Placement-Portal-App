const RECRUITMENT_STAGE_ORDER = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

const TIMELINE_BADGE_STAGE = "General Update";

const ROUND_SELECTION_MESSAGES = {
  NEXT_ROUND: "Congratulations! You have been selected for the next round.",
  HR_PASSED: "Congratulations! You have passed the current stage.",
};

const LEGACY_NEXT_ROUND_PREFIX = "Congratulations! You have been selected for the next round";
const LEGACY_HR_PREFIXES = [
  "Congratulations! You have cleared the HR Interview stage",
  "Congratulations! You have passed the current stage",
];

function getNextRoundName(sourceStage) {
  const idx = RECRUITMENT_STAGE_ORDER.indexOf(sourceStage);
  if (idx >= 0 && idx < RECRUITMENT_STAGE_ORDER.length - 1) {
    return RECRUITMENT_STAGE_ORDER[idx + 1];
  }
  return "Result";
}

function getRoundSelectionMessage(sourceStage) {
  if (sourceStage === "HR Interview") {
    return ROUND_SELECTION_MESSAGES.HR_PASSED;
  }
  return ROUND_SELECTION_MESSAGES.NEXT_ROUND;
}

function isRoundSelectionComment(comment) {
  if (!comment || typeof comment !== "string") return false;
  if (comment === ROUND_SELECTION_MESSAGES.NEXT_ROUND) return true;
  if (comment === ROUND_SELECTION_MESSAGES.HR_PASSED) return true;
  if (comment.startsWith(LEGACY_NEXT_ROUND_PREFIX)) return true;
  return LEGACY_HR_PREFIXES.some((prefix) => comment.startsWith(prefix));
}

/**
 * Find an existing round-selection timeline entry for a student and source stage.
 * Supports new (sourceStage + General Update badge) and legacy (stage = next round name) records.
 */
async function findExistingRoundSelectionEntry(OpportunityTimeline, opportunityId, studentId, sourceStage) {
  const oppId =
    typeof opportunityId === "string"
      ? opportunityId
      : opportunityId?.toString?.() || opportunityId;
  const sid = String(studentId).trim();
  const nextRoundName = getNextRoundName(sourceStage);

  const bySourceStage = await OpportunityTimeline.findOne({
    opportunityId: oppId,
    studentId: sid,
    type: "ROUND_SELECTION",
    sourceStage,
  });
  if (bySourceStage) return bySourceStage;

  return OpportunityTimeline.findOne({
    opportunityId: oppId,
    studentId: sid,
    type: "ROUND_SELECTION",
    $or: [
      { stage: nextRoundName, sourceStage: { $in: [null, undefined] } },
      {
        stage: TIMELINE_BADGE_STAGE,
        sourceStage: { $in: [null, undefined] },
        comment: getRoundSelectionMessage(sourceStage),
      },
    ],
  });
}

/**
 * Create a round-selection timeline entry idempotently.
 * Only selected, present students should call this.
 */
async function createRoundSelectionTimelineEntry({
  OpportunityTimeline,
  opportunityId,
  studentId,
  sourceStage,
  postedBy,
  role,
}) {
  const sid = String(studentId).trim();
  const existing = await findExistingRoundSelectionEntry(
    OpportunityTimeline,
    opportunityId,
    sid,
    sourceStage
  );
  if (existing) {
    return { entry: existing, created: false };
  }

  const payload = {
    opportunityId,
    studentId: sid,
    postedBy,
    role,
    stage: TIMELINE_BADGE_STAGE,
    sourceStage,
    comment: getRoundSelectionMessage(sourceStage),
    type: "ROUND_SELECTION",
    isStageActivation: false,
  };

  try {
    const entry = await OpportunityTimeline.create(payload);
    return { entry, created: true };
  } catch (err) {
    if (err.code === 11000) {
      const duplicate = await findExistingRoundSelectionEntry(
        OpportunityTimeline,
        opportunityId,
        sid,
        sourceStage
      );
      if (duplicate) {
        return { entry: duplicate, created: false };
      }
    }
    throw err;
  }
}

function filterTimelineForRole(timeline, userRole, viewerStudentId) {
  let filtered = timeline || [];

  if (userRole === "student") {
    const sid = viewerStudentId ? String(viewerStudentId).trim() : null;
    filtered = filtered.filter((entry) => {
      if (!entry.studentId) return true;
      if (!sid) return false;
      return String(entry.studentId).trim() === sid;
    });
    return filtered;
  }

  if (userRole === "faculty" || userRole === "admin") {
    return filtered.filter((entry) => !isRoundSelectionComment(entry.comment));
  }

  return filtered;
}

function inferSourceStage(entry) {
  if (entry.sourceStage) return entry.sourceStage;
  if (!isRoundSelectionComment(entry.comment)) return null;

  if (entry.stage === "Result") return "HR Interview";

  const idx = RECRUITMENT_STAGE_ORDER.indexOf(entry.stage);
  if (idx > 0) {
    return RECRUITMENT_STAGE_ORDER[idx - 1];
  }

  return null;
}

function dedupeTimelineEntries(entries) {
  const sorted = [...(entries || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  const byId = new Map();
  const roundSelectionKeys = new Set();

  for (const entry of sorted) {
    if (!entry) continue;

    if (isRoundSelectionComment(entry.comment) && entry.studentId) {
      const source = inferSourceStage(entry);
      if (source) {
        const selectionKey = [
          entry.opportunityId,
          String(entry.studentId).trim(),
          source,
          "ROUND_SELECTION",
        ].join("|");
        if (roundSelectionKeys.has(selectionKey)) continue;
        roundSelectionKeys.add(selectionKey);
      }
    }

    const contentKey = [
      entry.opportunityId,
      entry.studentId || "",
      entry.sourceStage || entry.stage || "",
      entry.type || "GENERAL",
      entry.comment || "",
    ].join("|");

    const mapKey = entry._id ? String(entry._id) : contentKey;
    if (!byId.has(mapKey)) {
      byId.set(mapKey, entry);
    }
  }

  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

module.exports = {
  RECRUITMENT_STAGE_ORDER,
  TIMELINE_BADGE_STAGE,
  ROUND_SELECTION_MESSAGES,
  getNextRoundName,
  getRoundSelectionMessage,
  isRoundSelectionComment,
  findExistingRoundSelectionEntry,
  createRoundSelectionTimelineEntry,
  filterTimelineForRole,
  dedupeTimelineEntries,
};
