/**
 * CSV Export Utility for Attendance
 * Converts attendance records to CSV format for download
 */

const { sanitizeFilenameForOS } = require("./filenameUtils");
const { sortApplicantsAlphabetically } = require("./applicantSort");

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
 * Convert applicants to CSV string with round-wise columns
 * @param {Array} applicants - Array of applicant objects with student data and rounds
 * @param {string} opportunityName - Name of the opportunity
 * @returns {string} CSV content
 */
const generateApplicantsCSV = (applicants, opportunityName = "Opportunity") => {
  if (!Array.isArray(applicants) || applicants.length === 0) {
    return "No applicants found for this opportunity";
  }

  const sortedApplicants = sortApplicantsAlphabetically(applicants);

  const headers = [
    "Sr. No.",
    "Student Name",
    "Roll Number",
    "Department",
    "Division",
    "Year",
    "Institute Email",
    "Personal Gmail",
    "Gender",
    "SSC Percentage",
    "HSC Percentage",
    "CGPA",
    "Technical Skills",
    "Phone Number",
    "Applied Date",
    "Aptitude",
    "Group Discussion",
    "Technical Interview",
    "HR Interview",
    "Result",
  ];

  const headerRow = headers.map(escapeCSVField).join(",");

  const dataRows = sortedApplicants.map((applicant, index) => {
    const student = applicant.student || {};
    const skills = Array.isArray(student.technicalSkills)
      ? student.technicalSkills.join("; ")
      : student.technicalSkills || "";
    const rounds = applicant.rounds || {};

    const cells = [
      escapeCSVField(index + 1),
      escapeCSVField(student.name || "N/A"),
      escapeCSVField(student.studentId || "N/A"),
      escapeCSVField(student.department || "N/A"),
      escapeCSVField(student.division || ""),
      escapeCSVField(student.year || "N/A"),
      escapeCSVField(student.email || "N/A"),
      escapeCSVField(student.personalGmail || ""),
      escapeCSVField(student.gender || ""),
      escapeCSVField(student.sscPercentage ?? ""),
      escapeCSVField(student.hscPercentage ?? ""),
      escapeCSVField(student.cgpa ?? ""),
      escapeCSVField(skills),
      escapeCSVField(student.phone || "N/A"),
      escapeCSVField(formatDateTime(applicant.appliedAt)),
      escapeCSVField(rounds["Aptitude Test"] || "Not Selected"),
      escapeCSVField(rounds["Group Discussion"] || "Not Selected"),
      escapeCSVField(rounds["Technical Interview"] || "Not Selected"),
      escapeCSVField(rounds["HR Interview"] || "Not Selected"),
      escapeCSVField(rounds.Result || "Not Selected"),
    ];

    return cells.join(",");
  });

  const lines = [
    `Applicants List - ${escapeCSVField(opportunityName)}`,
    "",
    `Total Applicants,${sortedApplicants.length}`,
    `Export Date,${formatDateTime(new Date())}`,
    "",
    headerRow,
    ...dataRows,
  ];

  return lines.join("\n");
};

/**
 * Generate student participation analytics CSV — one row per student
 */
const generateStudentParticipationCSV = (rows) => {
  const headers = [
    "Student Name",
    "Roll Number",
    "Department",
    "Division",
    "Year",
    "Institute Email",
    "Personal Gmail",
    "Gender",
    "Total Opportunities Eligible",
    "Total Opportunities Applied",
    "Total Aptitude Cleared",
    "Total GD Cleared",
    "Total Technical Cleared",
    "Total HR Cleared",
    "Total Selected",
    "Total Rejected",
    "Application Percentage",
    "Selection Percentage",
  ];

  const headerRow = headers.map(escapeCSVField).join(",");

  const dataRows = (rows || []).map((row) =>
    [
      escapeCSVField(row.name),
      escapeCSVField(row.studentId),
      escapeCSVField(row.department),
      escapeCSVField(row.division || ""),
      escapeCSVField(row.year),
      escapeCSVField(row.email),
      escapeCSVField(row.personalGmail || ""),
      escapeCSVField(row.gender || ""),
      escapeCSVField(row.totalEligible),
      escapeCSVField(row.totalApplied),
      escapeCSVField(row.totalClearedAptitude),
      escapeCSVField(row.totalClearedGD),
      escapeCSVField(row.totalClearedTechnical),
      escapeCSVField(row.totalClearedHR),
      escapeCSVField(row.totalSelected),
      escapeCSVField(row.totalRejected),
      escapeCSVField(row.applicationPercentage),
      escapeCSVField(row.selectionPercentage),
    ].join(",")
  );

  return [headerRow, ...dataRows].join("\n");
};

const generateStudentParticipationFilename = (department = "all") => {
  const sanitizeName = (name) =>
    String(name)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .substring(0, 50);

  return `student_participation_${sanitizeName(department || "all")}.csv`;
};

const normalizeOpportunityHeading = (opportunity) => {
  if (!opportunity) return "";
  if (typeof opportunity === "string") return opportunity;
  return opportunity.announcementHeading || opportunity.name || opportunity.title || opportunity.companyName || opportunity.displayName || "";
};

const normalizeOpportunityDefinition = (opportunity) => {
  const heading = normalizeOpportunityHeading(opportunity);
  const activeStages = Array.isArray(opportunity?.activeStages)
    ? opportunity.activeStages.filter(Boolean)
    : [];

  return {
    heading,
    name: heading || "Opportunity",
    activeStages,
  };
};

const normalizeOpportunities = (opportunities = []) => {
  if (!Array.isArray(opportunities)) return [];

  return opportunities
    .map((opportunity) => normalizeOpportunityDefinition(opportunity))
    .filter((opportunity) => opportunity.heading);
};

const getOpportunityExportStageNames = (opportunityData, rows = []) => {
  const normalizedOpportunity = normalizeOpportunityDefinition(opportunityData);
  if (normalizedOpportunity.activeStages.length > 0) {
    return normalizedOpportunity.activeStages;
  }

  const firstRow = Array.isArray(rows) ? rows.find(Boolean) : null;
  const inferredStages = firstRow?.stageStatuses || firstRow?.stageStatusMap || {};
  return Object.keys(inferredStages).filter(Boolean);
};

const getOpportunityExportState = (row = {}, opportunityName = "") => {
  const opportunityAnalytics = row.opportunityAnalytics || {};
  const analyticsForOpportunity = opportunityAnalytics[opportunityName] || opportunityAnalytics[opportunityName?.toLowerCase?.()] || null;

  if (analyticsForOpportunity && typeof analyticsForOpportunity === "object") {
    const applied = analyticsForOpportunity.applied ?? analyticsForOpportunity.isApplied ?? analyticsForOpportunity.appliedStatus ?? false;
    const stages = analyticsForOpportunity.stages || analyticsForOpportunity.stageStatuses || {};
    return {
      applied: Boolean(applied),
      stages,
    };
  }

  const fallbackAppliedValue = row.opportunityApplications?.[opportunityName] || row.opportunityApplications?.[opportunityName?.toLowerCase?.()];
  const applied = fallbackAppliedValue === true || fallbackAppliedValue === "YES" || fallbackAppliedValue === "Yes" || fallbackAppliedValue === "yes" || fallbackAppliedValue === "Y";

  return {
    applied,
    stages: {},
  };
};

const normalizeStageValue = (value) => {
  if (value === true || value === "YES" || value === "Yes" || value === "yes" || value === "Y" || value === "Qualified" || value === "qualified" || value === "Selected" || value === "selected") {
    return "Qualified";
  }
  return "Not Qualified";
};

const isPositiveExportValue = (value) => {
  if (value === true || value === "YES" || value === "Yes" || value === "yes" || value === "Y" || value === "Qualified" || value === "qualified" || value === "Selected" || value === "selected") {
    return true;
  }
  return false;
};

const getAppliedExportValue = (row = {}) => {
  if (isPositiveExportValue(row.applied) || isPositiveExportValue(row.opportunityApplied) || isPositiveExportValue(row.isApplied) || isPositiveExportValue(row.appliedStatus)) {
    return "YES";
  }

  if (row.appliedDate || row.appliedAt) {
    return "YES";
  }

  const stageValues = [
    row.aptitude,
    row.groupDiscussion,
    row.technicalInterview,
    row.hrInterview,
    row.result,
    ...(Object.values(row.stageStatuses || {})),
    ...(Object.values(row.stageStatusMap || {})),
  ];

  if (stageValues.some((value) => isPositiveExportValue(value))) {
    return "YES";
  }

  return "NO";
};

/** Fixed student identity columns matching the analytics spreadsheet template */
const STUDENT_ANALYTICS_BASE_HEADERS = [
  "Sr. No.",
  "Student Name",
  "Roll Number",
  "Department",
  "Division",
  "Year",
  "Institute Email",
  "Personal Gmail",
  "Gender",
  "SSC Percentage",
  "HSC Percentage",
  "CGPA",
  "Technical Skills",
  "Phone Number",
];

/**
 * Fixed per-opportunity stage columns (Row 2 under the opportunity title).
 * Matches the Admin/Faculty Student State download template exactly.
 */
const STUDENT_ANALYTICS_STAGE_HEADERS = [
  "Applied",
  "Aptitude Test",
  "Group Discussion",
  "Technical Interview",
  "HR Interview",
  "Result",
];

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildSpreadsheetCell = (value, { type = "String", style = "wrap" } = {}) => {
  const safe = escapeXml(value);
  if (safe === "") {
    return `<Cell ss:StyleID="${style}"/>`;
  }
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${safe}</Data></Cell>`;
};

const buildMergedSpreadsheetCell = (value, mergeAcross, { style = "headerOpportunity" } = {}) => {
  const safe = escapeXml(value);
  const mergeAttr = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : "";
  if (safe === "") {
    return `<Cell ss:StyleID="${style}"${mergeAttr}/>`;
  }
  return `<Cell ss:StyleID="${style}"${mergeAttr}><Data ss:Type="String">${safe}</Data></Cell>`;
};

const getStudentAnalyticsHeaders = (opportunities = []) => {
  const normalizedOpportunities = normalizeOpportunities(opportunities);
  return [
    ...STUDENT_ANALYTICS_BASE_HEADERS,
    ...normalizedOpportunities.flatMap((opportunity) =>
      STUDENT_ANALYTICS_STAGE_HEADERS.map((stageName) =>
        stageName === "Applied" ? `${opportunity.name} - Applied` : `${opportunity.name} - ${stageName}`
      )
    ),
  ];
};

/**
 * Student State analytics export — Excel SpreadsheetML (.xls)
 * Structure matches the placement tracker template:
 *  Row 1: student field titles + opportunity name spanning stage columns
 *  Row 2: blank under student fields + Applied / Aptitude / GD / Technical / HR / Result
 * Formatting: bold headers, center align, wrap text, vertical merge on student headers,
 * horizontal merge on each opportunity title.
 */
const generateStudentAnalyticsCSV = (rows = [], opportunities = []) => {
  const normalizedOpportunities = normalizeOpportunities(opportunities);
  const baseColCount = STUDENT_ANALYTICS_BASE_HEADERS.length;
  const stageColCount = STUDENT_ANALYTICS_STAGE_HEADERS.length;
  const totalCols = baseColCount + normalizedOpportunities.length * stageColCount;

  const columnXml = Array.from({ length: Math.max(totalCols, 1) }, (_, index) => {
    // Wider wrap-friendly widths for skills + stage status columns
    const width = index < baseColCount ? (index === 12 ? 28 : index === 1 || index === 6 || index === 7 ? 22 : 14) : 16;
    return `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`;
  }).join("");

  // Row 1: student headers (vertically merged with row 2) + opportunity titles (horizontally merged)
  const headerRow1Cells = [
    ...STUDENT_ANALYTICS_BASE_HEADERS.map((header) =>
      `<Cell ss:StyleID="headerBase" ss:MergeDown="1"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
    ),
    ...normalizedOpportunities.flatMap((opportunity) => [
      buildMergedSpreadsheetCell(opportunity.name, stageColCount - 1, { style: "headerOpportunity" }),
    ]),
  ].join("");

  // Row 2: skip vertically-merged student columns, then stage sub-headers per opportunity
  let headerRow2Cells = "";
  if (normalizedOpportunities.length > 0) {
    const stageHeaderCellsForOneOpportunity = (isFirstBlock) =>
      STUDENT_ANALYTICS_STAGE_HEADERS.map((stageName, stageIndex) => {
        const indexAttr =
          isFirstBlock && stageIndex === 0 ? ` ss:Index="${baseColCount + 1}"` : "";
        return `<Cell${indexAttr} ss:StyleID="headerStage"><Data ss:Type="String">${escapeXml(stageName)}</Data></Cell>`;
      }).join("");

    headerRow2Cells = normalizedOpportunities
      .map((_, oppIndex) => stageHeaderCellsForOneOpportunity(oppIndex === 0))
      .join("");
  }

  const dataRowsXml = (rows || []).map((row, index) => {
    const baseCells = [
      buildSpreadsheetCell(index + 1, { type: "Number", style: "wrapCenter" }),
      buildSpreadsheetCell(row.studentName || "", { style: "wrap" }),
      buildSpreadsheetCell(row.rollNumber || "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.department || "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.division || "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.year || "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.instituteEmail || "", { style: "wrap" }),
      buildSpreadsheetCell(row.personalGmail || "", { style: "wrap" }),
      buildSpreadsheetCell(row.gender || "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.sscPercentage ?? "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.hscPercentage ?? "", { style: "wrapCenter" }),
      buildSpreadsheetCell(row.cgpa ?? "", { style: "wrapCenter" }),
      buildSpreadsheetCell(
        Array.isArray(row.technicalSkills) ? row.technicalSkills.join(", ") : row.technicalSkills || "",
        { style: "wrap" }
      ),
      buildSpreadsheetCell(row.phoneNumber || "", { style: "wrapCenter" }),
    ].join("");

    const opportunityCells = normalizedOpportunities
      .map((opportunity) => {
        const exportState = getOpportunityExportState(row, opportunity.name);
        const appliedLabel = exportState.applied ? "Yes" : "No";
        const stageCells = STUDENT_ANALYTICS_STAGE_HEADERS.map((stageName) => {
          if (stageName === "Applied") {
            return buildSpreadsheetCell(appliedLabel, { style: "wrapCenter" });
          }
          const stageValue = exportState.stages?.[stageName];
          return buildSpreadsheetCell(normalizeStageValue(stageValue), { style: "wrapCenter" });
        });
        return stageCells.join("");
      })
      .join("");

    return `<Row ss:AutoFitHeight="1">${baseCells}${opportunityCells}</Row>`;
  }).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="wrap">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="wrapCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="headerBase">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="headerOpportunity">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="headerStage">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Student State">
  <Table>
   ${columnXml}
   <Row ss:AutoFitHeight="1" ss:Height="30">${headerRow1Cells}</Row>
   <Row ss:AutoFitHeight="1" ss:Height="30">${headerRow2Cells}</Row>
   ${dataRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
};

const generateOpportunityAnalyticsCSV = (rows = [], opportunityName = "Opportunity", opportunityData = {}) => {
  const opportunity = normalizeOpportunityDefinition(opportunityData || opportunityName);
  const opportunityHeading = opportunity.name || opportunityName || "Opportunity";
  const stageNames = getOpportunityExportStageNames(opportunityData, rows);
  const headers = [
    "Sr. No.",
    "Student Name",
    "Roll Number",
    "Department",
    "Division",
    "Year",
    "Institute Email",
    "Personal Gmail",
    "Gender",
    "SSC Percentage",
    "HSC Percentage",
    "CGPA",
    "Technical Skills",
    "Phone Number",
    "Applied Date",
    `${opportunityHeading} - Applied`,
    ...stageNames.map((stageName) => `${opportunityHeading} - ${stageName}`),
  ];
  const headerRow = headers.map(escapeCSVField).join(",");
  const dataRows = (rows || []).map((row, index) => {
    const cells = [
      escapeCSVField(index + 1),
      escapeCSVField(row.studentName || ""),
      escapeCSVField(row.rollNumber || ""),
      escapeCSVField(row.department || ""),
      escapeCSVField(row.division || ""),
      escapeCSVField(row.year || ""),
      escapeCSVField(row.instituteEmail || ""),
      escapeCSVField(row.personalGmail || ""),
      escapeCSVField(row.gender || ""),
      escapeCSVField(row.sscPercentage ?? ""),
      escapeCSVField(row.hscPercentage ?? ""),
      escapeCSVField(row.cgpa ?? ""),
      escapeCSVField(Array.isArray(row.technicalSkills) ? row.technicalSkills.join(", ") : row.technicalSkills || ""),
      escapeCSVField(row.phoneNumber || ""),
      escapeCSVField(formatDateTime(row.appliedDate)),
      escapeCSVField(getAppliedExportValue(row)),
    ];

    stageNames.forEach((stageName) => {
      const stageValue = row.stageStatuses?.[stageName] || row.stageStatusMap?.[stageName] || row[stageName] || "";
      cells.push(escapeCSVField(normalizeStageValue(stageValue)));
    });

    return cells.join(",");
  });

  return [
    `Opportunity Analytics - ${escapeCSVField(opportunityHeading)}`,
    headerRow,
    ...dataRows,
  ].join("\n");
};

const generateStudentAnalyticsFilename = (role = "admin", department = "all") => {
  const now = new Date();
  const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStamp = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  // SpreadsheetML workbook — opens in Excel with merges + wrap matching the tracker template
  if (role === "faculty") {
    return `Students__${dateStamp}_${timeStamp}.xls`;
  }
  return `Students_All_Departments_${dateStamp}_${timeStamp}.xls`;
};

const generateOpportunityAnalyticsFilename = (opportunityName = "opportunity") => {
  const now = new Date();
  const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStamp = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  return `Opportunity_${sanitizeFilenameForOS(opportunityName || "opportunity")}_${dateStamp}_${timeStamp}.csv`;
};

/**
 * Generate filename for applicants CSV
 * @param {string} opportunityName - Name of the opportunity
 * @returns {string} Filename
 */
const generateApplicantsFilename = (opportunityName = "opportunity") => {
  return `${sanitizeFilenameForOS(opportunityName)}.csv`;
};

const generateResumesZipFilename = (opportunityName = "opportunity") => {
  return `${sanitizeFilenameForOS(opportunityName)}_Resumes.zip`;
};

module.exports = {
  generateAttendanceCSV,
  generateAttendanceFilename,
  generateApplicantsCSV,
  generateApplicantsFilename,
  generateResumesZipFilename,
  generateStudentParticipationCSV,
  generateStudentParticipationFilename,
  generateStudentAnalyticsCSV,
  generateOpportunityAnalyticsCSV,
  generateStudentAnalyticsFilename,
  generateOpportunityAnalyticsFilename,
  escapeCSVField,
  formatDateTime,
};
