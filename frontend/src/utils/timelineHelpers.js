export const ROUND_SELECTION_MESSAGES = {
  NEXT_ROUND: "Congratulations! You have been selected for the next round.",
  HR_PASSED: "Congratulations! You have passed the current stage.",
};

const LEGACY_NEXT_ROUND_PREFIX = "Congratulations! You have been selected for the next round";
const LEGACY_HR_PREFIXES = [
  "Congratulations! You have cleared the HR Interview stage",
  "Congratulations! You have passed the current stage",
];

export function isRoundSelectionComment(comment) {
  if (!comment || typeof comment !== "string") return false;
  if (comment === ROUND_SELECTION_MESSAGES.NEXT_ROUND) return true;
  if (comment === ROUND_SELECTION_MESSAGES.HR_PASSED) return true;
  if (comment.startsWith(LEGACY_NEXT_ROUND_PREFIX)) return true;
  return LEGACY_HR_PREFIXES.some((prefix) => comment.startsWith(prefix));
}

export function filterTimelineForRole(entries, userRole, viewerStudentId) {
  const list = Array.isArray(entries) ? entries : [];

  if (userRole === "student") {
    const sid = viewerStudentId ? String(viewerStudentId).trim() : null;
    return list.filter((entry) => {
      if (!entry.studentId) return true;
      if (!sid) return false;
      return String(entry.studentId).trim() === sid;
    });
  }

  if (userRole === "faculty" || userRole === "admin") {
    return list.filter((entry) => !isRoundSelectionComment(entry.comment));
  }

  return list;
}

const STAGE_ORDER = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

function inferSourceStage(entry) {
  if (entry.sourceStage) return entry.sourceStage;
  if (!isRoundSelectionComment(entry.comment)) return null;
  if (entry.stage === "Result") return "HR Interview";
  const idx = STAGE_ORDER.indexOf(entry.stage);
  if (idx > 0) return STAGE_ORDER[idx - 1];
  return null;
}

export function dedupeTimelineEntries(entries) {
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

    const mapKey = entry._id ? String(entry._id) : [
      entry.opportunityId,
      entry.studentId || "",
      entry.sourceStage || entry.stage || "",
      entry.type || "GENERAL",
      entry.comment || "",
    ].join("|");

    if (!byId.has(mapKey)) {
      byId.set(mapKey, entry);
    }
  }

  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
