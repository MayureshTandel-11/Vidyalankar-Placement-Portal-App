const { OPPORTUNITY_BROADCAST_ALL } = require("../constants/departments");

const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const norm = (s) => String(s || "").trim().toLowerCase();

/**
 * Departments listed on an opportunity (comma-separated) plus broadcast token.
 */
const parseOpportunityDepartments = (departmentField) => {
  if (!departmentField && departmentField !== 0) return [];
  const raw = String(departmentField).trim();
  if (!raw) return [];
  if (norm(raw) === norm(OPPORTUNITY_BROADCAST_ALL)) return [OPPORTUNITY_BROADCAST_ALL];
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
};

/**
 * True if the user's single department matches the opportunity audience
 * (all-depts token or comma-separated list), case-insensitive.
 */
const userDepartmentMatchesOpportunity = (userDepartment, opportunityDepartment) => {
  const u = norm(userDepartment);
  if (!u) return false;
  const parts = parseOpportunityDepartments(opportunityDepartment).map((d) => norm(d));
  if (parts.length === 0) return false;
  if (parts.includes(norm(OPPORTUNITY_BROADCAST_ALL))) return true;
  return parts.includes(u);
};

/**
 * Mongo $match fragment for student/faculty: "all" or comma-separated dept includes user's dept.
 */
const buildDepartmentAudienceMatch = (userDepartment) => {
  const trimmed = String(userDepartment || "").trim();
  if (!trimmed) {
    return { department: { $in: [] } };
  }
  const escaped = escapeRegex(trimmed);
  return {
    $or: [
      { department: OPPORTUNITY_BROADCAST_ALL },
      { department: new RegExp(`(^|,)\\s*${escaped}\\s*(,|$)`, "i") },
    ],
  };
};

const isCreator = (opportunity, user) =>
  Boolean(opportunity?.createdBy && user?._id && String(opportunity.createdBy) === String(user._id));

const canFacultyCollaborateOnOpportunity = (user, opportunity) => {
  if (!user || user.role !== "faculty" || !opportunity) return false;
  if (isCreator(opportunity, user)) return true;
  return userDepartmentMatchesOpportunity(user.department, opportunity.department);
};

const canFacultyDeleteOpportunity = (user, opportunity) => {
  if (!user || !opportunity) return false;
  if (user.role === "admin") return true;
  if (user.role !== "faculty") return false;
  return isCreator(opportunity, user);
};

const canFacultyEditOpportunityContent = (user, opportunity) => {
  if (!user || !opportunity) return false;
  if (user.role === "admin") return true;
  if (user.role !== "faculty") return false;
  return canFacultyCollaborateOnOpportunity(user, opportunity);
};

const canViewOpportunityAsAudience = (user, opportunity) => {
  if (!user || !opportunity) return false;
  if (user.role === "admin") return true;
  if (user.role !== "student" && user.role !== "faculty") return false;
  return userDepartmentMatchesOpportunity(user.department, opportunity.department);
};

module.exports = {
  escapeRegex,
  parseOpportunityDepartments,
  userDepartmentMatchesOpportunity,
  buildDepartmentAudienceMatch,
  isCreator,
  canFacultyCollaborateOnOpportunity,
  canFacultyDeleteOpportunity,
  canFacultyEditOpportunityContent,
  canViewOpportunityAsAudience,
};
