export const getApplicantSortName = (applicant) => {
  const student = applicant?.student || {};
  return (student.fullName || student.name || "").trim();
};

export const sortApplicantsAlphabetically = (applicants) => {
  if (!Array.isArray(applicants)) return [];
  return [...applicants].sort((a, b) =>
    getApplicantSortName(a).localeCompare(getApplicantSortName(b), "en", { sensitivity: "base" })
  );
};
