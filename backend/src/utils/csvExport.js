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
  const { includeDateColumns = true, includeMarkedBy = true } = options;

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

  // Combine header and data rows
  const csvContent = [headerRow, ...dataRows].join("\n");

  return csvContent;
};

/**
 * Generate filename for attendance CSV
 * @param {string} driveName - Name of the opportunity/drive
 * @param {string} stageName - Name of the stage
 * @returns {string} Filename
 */
const generateAttendanceFilename = (driveName = "attendance", stageName = "") => {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  const sanitizeName = (name) =>
    String(name)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .substring(0, 50);

  const sanitizedDrive = sanitizeName(driveName);
  const sanitizedStage = stageName ? `_${sanitizeName(stageName)}` : "";

  return `attendance_${sanitizedDrive}${sanitizedStage}_${dateStr}.csv`;
};

module.exports = {
  generateAttendanceCSV,
  generateAttendanceFilename,
  escapeCSVField,
  formatDateTime,
};
