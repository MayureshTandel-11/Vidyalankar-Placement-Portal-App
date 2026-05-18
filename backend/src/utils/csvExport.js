/**
 * CSV Export Utility for Attendance
 * Converts attendance records to CSV format for download
 */

/**
 * Escape CSV field values to handle commas, quotes, and newlines
 */
const escapeCSVField = (field) => {
  if (field === null || field === undefined) {
    return "";
  }

  const fieldStr = String(field);

  // If field contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (fieldStr.includes(",") || fieldStr.includes("\n") || fieldStr.includes('"')) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }

  return fieldStr;
};

/**
 * Format a date to readable format (YYYY-MM-DD HH:MM:SS)
 */
const formatDateTime = (date) => {
  if (!date) return "";

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Convert attendance records to CSV string
 * @param {Array} attendanceRecords - Array of attendance records
 * @param {Object} options - Options for CSV export
 * @returns {string} CSV content
 */
const generateAttendanceCSV = (attendanceRecords, options = {}) => {
  const {
    includeDateColumns = true,
    includeMarkedBy = true,
    includeSummary = false,
    includeFacultyInfo = false,
    stageStatus = null,
  } = options;

  // CSV Headers
  const headers = [
    "Roll Number",
    "Student Name",
    "Department",
    "Status",
  ];

  if (includeDateColumns) {
    headers.push("Marked At");
  }

  if (includeMarkedBy) {
    headers.push("Marked By");
  }

  // Create header row
  const headerRow = headers.map(escapeCSVField).join(",");

  // Create data rows
  const dataRows = attendanceRecords.map((record) => {
    const cells = [
      escapeCSVField(record.studentId?.studentId || record.studentId || "N/A"),
      escapeCSVField(record.studentId?.name || "N/A"),
      escapeCSVField(record.studentId?.department || "N/A"),
      escapeCSVField(record.status || "pending"),
    ];

    if (includeDateColumns) {
      cells.push(escapeCSVField(formatDateTime(record.markedAt)));
    }

    if (includeMarkedBy) {
      cells.push(escapeCSVField(record.markedBy?.name || record.markedBy || ""));
    }

    return cells.join(",");
  });

  const lines = [headerRow, ...dataRows];

  // Add summary section if requested
  if (includeSummary) {
    // Empty line for spacing
    lines.push("");

    // Summary header
    lines.push("Summary Statistics");
    lines.push("");

    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
    const absentCount = attendanceRecords.filter((a) => a.status === "absent").length;
    const pendingCount = attendanceRecords.filter((a) => a.status === "pending").length;

    // Summary rows
    lines.push(`Total Records,${totalRecords}`);
    lines.push(`Present,${presentCount}`);
    lines.push(`Absent,${absentCount}`);
    lines.push(`Pending,${pendingCount}`);
    lines.push(`Attendance Rate,"${totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : 0}%"`);
  }

  // Add faculty info section if requested
  if (includeFacultyInfo && stageStatus) {
    lines.push("");
    lines.push("Submission Details");
    lines.push("");
    lines.push(`Submitted At,${formatDateTime(stageStatus.submittedAt)}`);
    lines.push(`Submitted By,${stageStatus.submittedBy?.name || "Admin"}`);
    lines.push(`Export Timestamp,${formatDateTime(new Date())}`);
  }

  // Combine all lines
  const csvContent = lines.join("\n");

  return csvContent;
};

/**
 * Generate filename for attendance CSV with stage-specific naming
 * @param {string} driveName - Name of the opportunity/drive (optional, not used for stage-specific filenames)
 * @param {string} stageName - Name of the stage
 * @returns {string} Filename
 */
const generateAttendanceFilename = (driveName = "attendance", stageName = "") => {
  // Map stage names to standard filenames as per requirements
  const stageFilenameMap = {
    "Aptitude Test": "aptitude_test_attendance",
    "Group Discussion": "group_discussion_attendance",
    "Technical Interview": "technical_interview_attendance",
    "HR Interview": "hr_interview_attendance",
    "Result": "result_attendance",
  };

  // Get the standard filename for the stage, or generate one if stage not in map
  const sanitizeName = (name) =>
    String(name)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .substring(0, 50);

  let filename = stageFilenameMap[stageName];
  if (!filename) {
    // Fallback for any custom or unrecognized stages
    filename = `attendance_${sanitizeName(stageName)}`;
  }

  // Add .csv extension
  return `${filename}.csv`;
};

/**
 * Convert applicants to CSV string
 * @param {Array} applicants - Array of applicant objects with student data
 * @param {string} opportunityName - Name of the opportunity
 * @returns {string} CSV content
 */
const generateApplicantsCSV = (applicants, opportunityName = "Opportunity") => {
  if (!Array.isArray(applicants) || applicants.length === 0) {
    return "No applicants found for this opportunity";
  }

  // CSV Headers
  const headers = [
    "Sr. No.",
    "Student Name",
    "Email",
    "PRN",
    "Department",
    "Year",
    "Phone",
    "Applied On",
  ];

  // Create header row
  const headerRow = headers.map(escapeCSVField).join(",");

  // Create data rows
  const dataRows = applicants.map((applicant, index) => {
    const student = applicant.student || {};
    const cells = [
      escapeCSVField(index + 1),
      escapeCSVField(student.name || "N/A"),
      escapeCSVField(student.email || "N/A"),
      escapeCSVField(student.studentId || "N/A"),
      escapeCSVField(student.department || "N/A"),
      escapeCSVField(student.year || "N/A"),
      escapeCSVField(student.phone || "N/A"),
      escapeCSVField(formatDateTime(applicant.appliedAt)),
    ];

    return cells.join(",");
  });

  const lines = [
    // Header with opportunity name
    `Applicants List - ${escapeCSVField(opportunityName)}`,
    "",
    // Metadata
    `Total Applicants,${applicants.length}`,
    `Export Date,${formatDateTime(new Date())}`,
    "",
    // Column headers
    headerRow,
    // Data rows
    ...dataRows,
  ];

  return lines.join("\n");
};

/**
 * Generate filename for applicants CSV
 * @param {string} opportunityName - Name of the opportunity
 * @returns {string} Filename
 */
const generateApplicantsFilename = (opportunityName = "opportunity") => {
  const sanitizeName = (name) =>
    String(name)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .substring(0, 50);

  const filename = `applicants_${sanitizeName(opportunityName)}`;
  return `${filename}.csv`;
};

module.exports = {
  generateAttendanceCSV,
  generateAttendanceFilename,
  generateApplicantsCSV,
  generateApplicantsFilename,
  escapeCSVField,
  formatDateTime,
};
