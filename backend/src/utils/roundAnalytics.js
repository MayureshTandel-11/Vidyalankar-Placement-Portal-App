const OpportunityAttendance = require("../models/OpportunityAttendance");
const {
  RECRUITMENT_STAGE_ORDER,
  getEligibleStagesForStudent,
  hasApplied,
} = require("./studentProgression");
const { parseOpportunityDepartments, userDepartmentMatchesOpportunity } = require("./opportunityAccess");
const { OPPORTUNITY_BROADCAST_ALL } = require("../constants/departments");

const CSV_STAGE_HEADERS = {
  "Aptitude Test": "Aptitude",
  "Group Discussion": "Group Discussion",
  "Technical Interview": "Technical Interview",
  "HR Interview": "HR Interview",
  Result: "Result",
};

const normalizeStudentId = (studentId) => (studentId ? String(studentId).trim() : "");

const buildAttendanceMap = (records) => {
  const map = new Map();
  for (const record of records || []) {
    const key = `${normalizeStudentId(record.studentId)}:${record.stage}`;
    map.set(key, record);
  }
  return map;
};

const isStudentClearedStage = (opportunity, studentId, stage, attendanceMap, attendanceRecords = []) => {
  const sid = normalizeStudentId(studentId);
  if (!sid || !stage) return false;

  const eligible = getEligibleStagesForStudent(opportunity, sid, attendanceRecords);
  if (!eligible.has(stage)) return false;

  const record = attendanceMap.get(`${sid}:${stage}`);
  return record?.status === "present";
};

const getRoundCsvLabel = (opportunity, studentId, stage, attendanceMap, attendanceRecords = []) => {
  return isStudentClearedStage(opportunity, studentId, stage, attendanceMap, attendanceRecords)
    ? "Selected"
    : "Not Selected";
};

const countApplicantsClearedStage = (opportunity, stage, attendanceRecords) => {
  const applicants = opportunity.applications || [];
  const attendanceMap = buildAttendanceMap(attendanceRecords);
  let count = 0;
  for (const app of applicants) {
    if (isStudentClearedStage(opportunity, app.studentId, stage, attendanceMap, attendanceRecords)) {
      count += 1;
    }
  }
  return count;
};

const countSelectedStudents = (opportunity, attendanceRecords) => {
  return countApplicantsClearedStage(opportunity, "Result", attendanceRecords);
};

const buildEligibleStudentsQuery = (opportunity) => {
  const depts = parseOpportunityDepartments(opportunity.department);
  const query = { role: "student", isVerified: true };

  if (depts.length > 0 && !depts.includes(OPPORTUNITY_BROADCAST_ALL)) {
    query.department = { $in: depts };
  }

  if (Array.isArray(opportunity.eligibleYears) && opportunity.eligibleYears.length > 0) {
    query.year = { $in: opportunity.eligibleYears };
  }

  if (Array.isArray(opportunity.eligibleGenders) && opportunity.eligibleGenders.length > 0) {
    query.$or = [
      { gender: { $in: opportunity.eligibleGenders } },
      { gender: { $exists: false } },
      { gender: null },
      { gender: "" },
    ];
  }

  return query;
};

const studentMatchesOpportunityEligibility = (student, opportunity) => {
  if (!student || !opportunity) return false;
  if (!userDepartmentMatchesOpportunity(student.department, opportunity.department)) return false;

  if (Array.isArray(opportunity.eligibleYears) && opportunity.eligibleYears.length > 0) {
    if (!student.year || !opportunity.eligibleYears.includes(student.year)) return false;
  }

  if (Array.isArray(opportunity.eligibleGenders) && opportunity.eligibleGenders.length > 0) {
    if (student.gender && !opportunity.eligibleGenders.includes(student.gender)) return false;
  }

  return true;
};

module.exports = {
  RECRUITMENT_STAGE_ORDER,
  CSV_STAGE_HEADERS,
  normalizeStudentId,
  buildAttendanceMap,
  isStudentClearedStage,
  getRoundCsvLabel,
  countApplicantsClearedStage,
  countSelectedStudents,
  buildEligibleStudentsQuery,
  studentMatchesOpportunityEligibility,
};
