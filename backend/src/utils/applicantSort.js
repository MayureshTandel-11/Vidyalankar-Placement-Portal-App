/**
 * Resolve display/sort name for an applicant record.
 * Prefers full name, falls back to name (first name field in schema).
 */
const getApplicantSortName = (applicant) => {
  const student = applicant?.student || {};
  return (student.fullName || student.name || "").trim();
};

/**
 * Sort applicants alphabetically by student full name (A → Z).
 */
const sortApplicantsAlphabetically = (applicants) => {
  if (!Array.isArray(applicants)) return [];
  return [...applicants].sort((a, b) =>
    getApplicantSortName(a).localeCompare(getApplicantSortName(b), "en", { sensitivity: "base" })
  );
};

module.exports = { getApplicantSortName, sortApplicantsAlphabetically };
