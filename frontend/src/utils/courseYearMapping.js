/**
 * Course to Year Options Mapping
 * Provides dynamic year options based on selected course (UG or PG)
 */

const UG_COURSES = [
  "B.Sc.IT",
  "B.Sc.DS",
  "B.Sc.AI/ML",
  "B.B.A",
  "B.A.F",
  "B.M.S",
  "B.B.I",
  "B.F.M",
  "B.F.A",
  "B.A.D.M.C",
  "B.A.M.M.C",
];

const PG_COURSES = [
  "M.Sc.IT",
  "M.Sc.AI/DS",
  "M.Sc.CyberSecurity",
  "M.Com.(AA)",
  "M.Com.(B&A)",
  "M.Com.(B&F)",
  "M.Com.(BM)",
  "M.A.(EMA)",
];

const UG_YEARS = ["First Year", "Second Year", "Third Year"];
const PG_YEARS = ["Masters"];

/**
 * Get available year options for a given course
 * @param {string} course - The course name (e.g., "B.Sc.IT", "M.Sc.IT")
 * @returns {string[]} Array of available years for the course
 */
export const getYearsForCourse = (course) => {
  if (!course || course.trim() === "") {
    return [];
  }

  if (UG_COURSES.includes(course)) {
    return UG_YEARS;
  }

  if (PG_COURSES.includes(course)) {
    return PG_YEARS;
  }

  // Fallback for unknown courses
  return [];
};

export default {
  getYearsForCourse,
  UG_COURSES,
  PG_COURSES,
  UG_YEARS,
  PG_YEARS,
};
