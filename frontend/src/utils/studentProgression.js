const RECRUITMENT_STAGE_ORDER = [
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

const NON_RECRUITMENT_STAGES = new Set(["General Update"]);

function normalizeStudentId(studentId) {
  return studentId ? String(studentId).trim() : "";
}

function hasApplied(opportunity, studentId) {
  const sid = normalizeStudentId(studentId);
  return (opportunity?.applications || []).some(
    (app) => app.studentId && normalizeStudentId(app.studentId) === sid
  );
}

function getSelectedInStage(opportunity, stage) {
  const manual = opportunity?.stageManualSelections?.find((s) => s.stage === stage);
  return new Set((manual?.selectedStudentIds || []).map((id) => normalizeStudentId(id)));
}

export function getEligibleStagesForStudent(opportunity, studentId, attendanceRecords = []) {
  const sid = normalizeStudentId(studentId);
  const eligible = new Set();
  if (!opportunity || !sid || !hasApplied(opportunity, sid)) {
    return eligible;
  }

  eligible.add("Aptitude Test");

  for (let i = 1; i < RECRUITMENT_STAGE_ORDER.length; i++) {
    const stage = RECRUITMENT_STAGE_ORDER[i];
    const prevStage = RECRUITMENT_STAGE_ORDER[i - 1];
    const selected = getSelectedInStage(opportunity, prevStage);
    if (!selected.has(sid)) break;

    const prevRecord = (attendanceRecords || []).find(
      (r) => r.stage === prevStage && normalizeStudentId(r.studentId) === sid
    );
    if (prevRecord?.status === "absent") break;

    eligible.add(stage);
  }

  return eligible;
}

export function isStudentActiveInProcess(opportunity, studentId, attendanceRecords = []) {
  const sid = normalizeStudentId(studentId);
  if (!hasApplied(opportunity, sid)) return false;

  const eligible = getEligibleStagesForStudent(opportunity, studentId, attendanceRecords);

  for (const record of attendanceRecords || []) {
    if (normalizeStudentId(record.studentId) !== sid) continue;
    if (record.status === "absent" && eligible.has(record.stage)) {
      return false;
    }
  }

  return eligible.size > 0;
}

export function filterActiveStagesForStudent(activeStages, opportunity, studentId, attendanceRecords = []) {
  const eligible = getEligibleStagesForStudent(opportunity, studentId, attendanceRecords);
  return (activeStages || []).filter((stage) => {
    if (NON_RECRUITMENT_STAGES.has(stage)) return hasApplied(opportunity, studentId);
    return eligible.has(stage);
  });
}

export function canStudentSeeTimelineEntry(entry, opportunity, studentId, attendanceRecords = []) {
  const sid = normalizeStudentId(studentId);
  if (!sid || !opportunity) return false;

  if (!isStudentActiveInProcess(opportunity, sid, attendanceRecords)) {
    if (entry.studentId && normalizeStudentId(entry.studentId) === sid) {
      const stage = entry.stage || "";
      if (entry.type === "ROUND_SELECTION" || NON_RECRUITMENT_STAGES.has(stage)) {
        return true;
      }
    }
    return false;
  }

  if (entry.studentId) {
    return normalizeStudentId(entry.studentId) === sid;
  }

  const stage = entry.stage || "";
  if (NON_RECRUITMENT_STAGES.has(stage)) {
    return hasApplied(opportunity, sid);
  }

  const eligible = getEligibleStagesForStudent(opportunity, sid, attendanceRecords);
  if (!eligible.has(stage)) return false;

  if (entry.isStageActivation) return eligible.has(stage);
  if (RECRUITMENT_STAGE_ORDER.includes(stage)) return eligible.has(stage);

  return hasApplied(opportunity, sid);
}
