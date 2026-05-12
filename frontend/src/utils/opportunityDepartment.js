import { OPPORTUNITY_BROADCAST_ALL } from "../constants/departments";

const norm = (s) => String(s || "").trim().toLowerCase();

export const parseOpportunityDepartments = (departmentField) => {
  if (departmentField == null) return [];
  const raw = String(departmentField).trim();
  if (!raw) return [];
  if (norm(raw) === norm(OPPORTUNITY_BROADCAST_ALL)) return [OPPORTUNITY_BROADCAST_ALL];
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
};

export const userDepartmentMatchesOpportunity = (userDepartment, opportunityDepartment) => {
  const u = norm(userDepartment);
  if (!u) return false;
  const parts = parseOpportunityDepartments(opportunityDepartment).map((d) => norm(d));
  if (parts.length === 0) return false;
  if (parts.includes(norm(OPPORTUNITY_BROADCAST_ALL))) return true;
  return parts.includes(u);
};

export const facultyCanCollaborateOnOpportunity = (user, opportunity) => {
  if (!user || user.role !== "faculty" || !opportunity) return false;
  if (String(opportunity.createdBy || "") === String(user._id || "")) return true;
  return userDepartmentMatchesOpportunity(user.department, opportunity.department);
};

export const facultyCanDeleteOpportunity = (user, opportunity) => {
  if (!user || !opportunity) return false;
  if (user.role === "admin") return true;
  if (user.role !== "faculty") return false;
  return String(opportunity.createdBy || "") === String(user._id || "");
};
