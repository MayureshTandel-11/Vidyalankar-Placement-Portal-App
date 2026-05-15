import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getApiUrl } from "./apiClient";

/**
 * Student Profile PDF — mirrors `StudentProfileForm.jsx` field names & labels.
 * Uses jsPDF + jspdf-autotable (`autoTable(doc, {...})` — not `doc.autoTable`).
 *
 * @param {Record<string, unknown>} student Profile-shaped object (from API or merged management detail).
 * @param {string} [enrollmentNumber] Preferred Student ID when generating from faculty/admin views.
 */

const PRIMARY = [51, 65, 85];
const ACCENT = [79, 70, 229];
const BORDER = [203, 213, 225];
const MUTED = [100, 116, 139];
const LINK_BLUE = [37, 99, 235];

const PAGE_MARGIN_X = 15;
const PAGE_MARGIN_TOP = 16;
const PAGE_MARGIN_BOTTOM = 28;
const FONT_TITLE = 18;
const FONT_SECTION = 12;
const FONT_BODY = 10;
const FONT_SMALL = 9;
const LINE_HEIGHT = 4.8;

/** Labels copied from `StudentProfileForm.jsx` */
const L = {
  studentId: "Student ID",
  email: "Email",
  department: "Department",
  classYear: "Class Year",
  phone: "Phone Number",
  ssc: "SSC Percentage",
  hsc: "HSC Percentage",
  cgpa: "CGPA",
  technicalSkills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  professionalLinks: "Professional Links",
  linkedin: "LinkedIn Profile URL",
  github: "GitHub Profile URL",
  almaShine: "AlmaShine Profile URL",
  certIssuePrefix: "Issued by:",
  certIssueDate: "Issue Date:",
  certCredentialId: "Credential ID:",
  certCredentialUrl: "Credential URL:",
  projectTech: "Technologies Used",
  projectDesc: "Project Description",
  githubLink: "GitHub Link",
  liveLink: "Live Link",
};

function getPageWidth(doc) {
  return doc.internal.pageSize.getWidth();
}

function getPageHeight(doc) {
  return doc.internal.pageSize.getHeight();
}

function contentMaxWidth(doc) {
  return getPageWidth(doc) - PAGE_MARGIN_X * 2;
}

function contentBottom(doc) {
  return getPageHeight(doc) - PAGE_MARGIN_BOTTOM;
}

/**
 * If content would overflow the safe bottom margin, start a new page.
 * @returns {number} Y position to continue drawing (top margin when a new page was added).
 */
export function checkPageBreak(doc, currentY, neededHeight) {
  const bottom = contentBottom(doc);
  if (currentY + neededHeight > bottom) {
    doc.addPage();
    return PAGE_MARGIN_TOP;
  }
  return currentY;
}

/**
 * Section heading + horizontal rule (matches professional PDF sectioning).
 * @returns {number} Y after the divider.
 */
export function addSectionTitle(doc, title, y, colors = { primary: PRIMARY, border: BORDER }) {
  let yy = checkPageBreak(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_SECTION);
  doc.setTextColor(...colors.primary);
  doc.text(title, PAGE_MARGIN_X, yy);
  yy += 6;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.35);
  doc.line(PAGE_MARGIN_X, yy, getPageWidth(doc) - PAGE_MARGIN_X, yy);
  yy += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PRIMARY);
  return yy;
}

/**
 * Wrapped body text; returns next Y.
 */
export function addWrappedText(doc, text, x, y, maxWidth, opts = {}) {
  const lineHeight = opts.lineHeight ?? LINE_HEIGHT;
  const fontSize = opts.fontSize ?? FONT_BODY;
  doc.setFontSize(fontSize);
  const raw = text === null || text === undefined ? "" : String(text);
  const lines = doc.splitTextToSize(raw, maxWidth);
  let yy = y;
  for (let i = 0; i < lines.length; i++) {
    yy = checkPageBreak(doc, yy, lineHeight + 1);
    doc.text(lines[i], x, yy);
    yy += lineHeight;
  }
  return yy;
}

function ensureHttp(url) {
  if (!url || typeof url !== "string") return "";
  const t = url.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Renders URL as blue, clickable link lines (jsPDF `link` annotations).
 * @returns {number} next Y
 */
export function addLinkedUrlLines(doc, url, x, y, maxWidth) {
  const href = ensureHttp(url);
  if (!href) return y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(...LINK_BLUE);

  const lines = doc.splitTextToSize(String(url).trim(), maxWidth);
  let yy = y;
  const lh = LINE_HEIGHT;
  for (const line of lines) {
    yy = checkPageBreak(doc, yy, lh + 1);
    const w = doc.getTextWidth(line);
    doc.text(line, x, yy);
    doc.link(x, yy - lh + 2.5, Math.min(w + 1, maxWidth), lh + 1, { url: href });
    yy += lh;
  }
  doc.setTextColor(...PRIMARY);
  return yy;
}

// function resolveResumeHref(resumeUrl) {
//   if (!resumeUrl || typeof resumeUrl !== "string") return "";
//   const u = resumeUrl.trim();
//   if (!u) return "";
//   if (/^https?:\/\//i.test(u)) return u;
//   try {
//     const apiBase = getApiUrl() || "";
//     const origin = typeof window !== "undefined" ? window.location.origin : "";
//     const base = String(apiBase).replace(/\/api\/?$/i, "") || origin;
//     const path = u.replace(/^\//, "");
//     return base ? `${base.replace(/\/$/, "")}/${path}` : u;
//   } catch {
//     return ensureHttp(u);
//   }
// }

function formatDisplayName(student) {
  const n = student?.fullName || student?.name;
  return n && String(n).trim() ? String(n).trim() : "—";
}

function formatMaybePercentage(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `${n}%`;
}

function formatCgpa(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return String(n);
}

function formatIssueDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeSkills(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => (s === null || s === undefined ? "" : String(s).trim())).filter(Boolean);
}

function classifyProjectLink(link) {
  if (!link || typeof link !== "string") return { github: "", live: "" };
  const t = link.trim();
  if (!t) return { github: "", live: "" };
  const lower = t.toLowerCase();
  if (lower.includes("github.com")) return { github: t, live: "" };
  return { github: "", live: t };
}

function sanitizeFilenamePart(s) {
  return String(s || "profile").replace(/[^\w\-]+/g, "_").slice(0, 80);
}

function drawFooterPages(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(FONT_SMALL);
    doc.setTextColor(...MUTED);
    doc.text(
      "Generated by Vidyalankar Placement Portal",
      getPageWidth(doc) / 2,
      getPageHeight(doc) - 14,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, getPageWidth(doc) / 2, getPageHeight(doc) - 8, { align: "center" });
  }
}

function addMetaRow(doc, label, value, x, y, labelWidth, maxWidth) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_BODY);
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  const valueX = x + labelWidth;
  const vw = maxWidth - labelWidth;
  const lines = doc.splitTextToSize(text, vw);
  let yy = y;
  lines.forEach((line) => {
    doc.text(line, valueX, yy);
    yy += LINE_HEIGHT;
  });
  return y + Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT) + 2;
}

function renderBulletSkills(doc, skills, startY) {
  const maxW = contentMaxWidth(doc);
  let y = startY;
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(...PRIMARY);

  if (!skills.length) {
    y = checkPageBreak(doc, y, LINE_HEIGHT);
    doc.setTextColor(...MUTED);
    doc.text("—", PAGE_MARGIN_X, y);
    doc.setTextColor(...PRIMARY);
    return y + LINE_HEIGHT + 4;
  }

  const wrapW = maxW - 6;
  for (const skill of skills) {
    const lines = doc.splitTextToSize(skill, wrapW);
    lines.forEach((line, i) => {
      y = checkPageBreak(doc, y, LINE_HEIGHT + 1);
      const xStart = i === 0 ? PAGE_MARGIN_X : PAGE_MARGIN_X + 6;
      doc.text(i === 0 ? `• ${line}` : line, xStart, y);
      y += LINE_HEIGHT;
    });
    y += 1;
  }
  return y + 4;
}

function renderCertificationCard(doc, cert, startY) {
  const maxW = contentMaxWidth(doc);
  let y = startY;

  const title = cert?.title != null && String(cert.title).trim() ? String(cert.title) : "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_BODY + 0.5);
  y = addWrappedText(doc, title, PAGE_MARGIN_X, y, maxW, { lineHeight: LINE_HEIGHT + 0.3 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_BODY);

  const issuerLine = `${L.certIssuePrefix} ${cert?.issuer != null && String(cert.issuer).trim() ? String(cert.issuer) : "—"}`;
  y = addWrappedText(doc, issuerLine, PAGE_MARGIN_X, y + 2, maxW);

  const idLine = `${L.certIssueDate} ${formatIssueDate(cert?.issueDate)}`;
  y = addWrappedText(doc, idLine, PAGE_MARGIN_X, y + 1, maxW);

  const credId =
    cert?.credentialId ??
    cert?.credentialID ??
    cert?.credential_id ??
    cert?.credentialNumber ??
    "";
  if (credId !== null && credId !== undefined && String(credId).trim()) {
    y = addWrappedText(doc, `${L.certCredentialId} ${String(credId)}`, PAGE_MARGIN_X, y + 1, maxW);
  }

  const credUrl =
    cert?.credentialUrl ??
    cert?.credentialURL ??
    cert?.credential_url ??
    cert?.url ??
    "";
  if (credUrl !== null && credUrl !== undefined && String(credUrl).trim()) {
    y += 3;
    y = checkPageBreak(doc, y, LINE_HEIGHT * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_BODY);
    doc.text(L.certCredentialUrl, PAGE_MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    y = addLinkedUrlLines(doc, String(credUrl).trim(), PAGE_MARGIN_X, y + LINE_HEIGHT, maxW);
  }

  return y + 6;
}

function renderProjectCard(doc, project, startY) {
  const maxW = contentMaxWidth(doc);
  let y = startY;

  const title = project?.title != null && String(project.title).trim() ? String(project.title) : "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_BODY + 0.5);
  y = addWrappedText(doc, title, PAGE_MARGIN_X, y, maxW, { lineHeight: LINE_HEIGHT + 0.3 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_BODY);

  const techs = normalizeSkills(project?.technologies);
  const techLine =
    techs.length > 0 ? `${L.projectTech}: ${techs.join(", ")}` : `${L.projectTech}: —`;
  y = addWrappedText(doc, techLine, PAGE_MARGIN_X, y + 2, maxW);

  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, `${L.projectDesc}:`, PAGE_MARGIN_X, y + 3, maxW);
  doc.setFont("helvetica", "normal");
  const desc =
    project?.description != null && String(project.description).trim()
      ? String(project.description)
      : "—";
  y = addWrappedText(doc, desc, PAGE_MARGIN_X, y + 1, maxW);

  const rawLink = project?.link != null ? String(project.link).trim() : "";
  const { github, live } = classifyProjectLink(rawLink);

  if (github) {
    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, `${L.githubLink}:`, PAGE_MARGIN_X, y + 3, maxW);
    doc.setFont("helvetica", "normal");
    y = addLinkedUrlLines(doc, github, PAGE_MARGIN_X, y + 3, maxW);
  }
  if (live) {
    doc.setFont("helvetica", "bold");
    y = addWrappedText(doc, `${L.liveLink}:`, PAGE_MARGIN_X, y + 3, maxW);
    doc.setFont("helvetica", "normal");
    y = addLinkedUrlLines(doc, live, PAGE_MARGIN_X, y + 3, maxW);
  }

  return y + 6;
}

export const generateStudentProfilePDF = (student, enrollmentNumber) => {
  try {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = PAGE_MARGIN_TOP;

    const displayName = formatDisplayName(student);
    const sid = enrollmentNumber ?? student?.studentId ?? "";
    const email = student?.email != null && String(student.email).trim() ? String(student.email) : "";
    const dept = student?.department != null && String(student.department).trim() ? String(student.department) : "";
    const classYear =
      student?.year != null && String(student.year).trim() ? String(student.year) : "";
    const phone = student?.phone != null && String(student.phone).trim() ? String(student.phone) : "";

    const academicInfo = student?.academicInfo && typeof student.academicInfo === "object" ? student.academicInfo : {};
    const technicalSkills = normalizeSkills(student?.technicalSkills);
    const certifications = Array.isArray(student?.certifications) ? student.certifications : [];
    const projects = Array.isArray(student?.projects) ? student.projects : [];
    const professionalLinks =
      student?.professionalLinks && typeof student.professionalLinks === "object"
        ? student.professionalLinks
        : {};

    // --- Header ---
    doc.setFontSize(FONT_SMALL);
    doc.setTextColor(...MUTED);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, PAGE_MARGIN_X, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_TITLE);
    doc.setTextColor(...ACCENT);
    const nameLines = doc.splitTextToSize(displayName, contentMaxWidth(doc));
    for (const line of nameLines) {
      y = checkPageBreak(doc, y, LINE_HEIGHT + 4);
      doc.text(line, PAGE_MARGIN_X, y);
      y += LINE_HEIGHT + 2;
    }

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN_X, y, getPageWidth(doc) - PAGE_MARGIN_X, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_BODY);
    doc.setTextColor(...PRIMARY);

    const labelW = 42;
    const maxW = contentMaxWidth(doc);
    y = addMetaRow(doc, L.studentId, sid || "—", PAGE_MARGIN_X, y, labelW, maxW);
    y = addMetaRow(doc, L.email, email || "—", PAGE_MARGIN_X, y, labelW, maxW);
    y = addMetaRow(doc, L.department, dept || "—", PAGE_MARGIN_X, y, labelW, maxW);
    y = addMetaRow(doc, L.classYear, classYear || "—", PAGE_MARGIN_X, y, labelW, maxW);
    y = addMetaRow(doc, L.phone, phone || "—", PAGE_MARGIN_X, y, labelW, maxW);

    y += 4;

    // --- Academic (labels match form) ---
    y = addSectionTitle(doc, "Academic Information", y);
    const academicRows = [
      [L.ssc, formatMaybePercentage(academicInfo.sscPercentage)],
      [L.hsc, formatMaybePercentage(academicInfo.hscPercentage)],
      [L.cgpa, formatCgpa(academicInfo.cgpa)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: academicRows,
      theme: "grid",
      styles: { fontSize: FONT_BODY, cellPadding: 2.5, textColor: PRIMARY },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: getPageWidth(doc) - PAGE_MARGIN_X * 2 - 58 },
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    // --- Technical Skills ---
    y = addSectionTitle(doc, L.technicalSkills, y);
    y = renderBulletSkills(doc, technicalSkills, y);

    // --- Certifications (dynamic blocks, page breaks per card) ---
    y = addSectionTitle(doc, L.certifications, y);
    if (!certifications.length) {
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(...MUTED);
      y = checkPageBreak(doc, y, LINE_HEIGHT);
      doc.text("—", PAGE_MARGIN_X, y);
      doc.setTextColor(...PRIMARY);
      y += LINE_HEIGHT + 8;
    } else {
      certifications.forEach((cert) => {
        y = checkPageBreak(doc, y, 28);
        y = renderCertificationCard(doc, cert, y);
      });
    }

    // --- Projects ---
    y = addSectionTitle(doc, L.projects, y);
    if (!projects.length) {
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(...MUTED);
      y = checkPageBreak(doc, y, LINE_HEIGHT);
      doc.text("—", PAGE_MARGIN_X, y);
      doc.setTextColor(...PRIMARY);
      y += LINE_HEIGHT + 8;
    } else {
      projects.forEach((proj) => {
        y = checkPageBreak(doc, y, 36);
        y = renderProjectCard(doc, proj, y);
      });
    }

    // --- Professional links (form labels) ---
    y = addSectionTitle(doc, L.professionalLinks, y);
    const linkEntries = [];
    const li = professionalLinks.linkedinProfile;
    const gh = professionalLinks.githubProfile;
    const al = professionalLinks.almaShineProfile;
    if (li && String(li).trim()) linkEntries.push({ label: L.linkedin, url: String(li).trim() });
    if (gh && String(gh).trim()) linkEntries.push({ label: L.github, url: String(gh).trim() });
    if (al && String(al).trim()) linkEntries.push({ label: L.almaShine, url: String(al).trim() });

    if (!linkEntries.length) {
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(...MUTED);
      y = checkPageBreak(doc, y, LINE_HEIGHT);
      doc.text("—", PAGE_MARGIN_X, y);
      doc.setTextColor(...PRIMARY);
      y += LINE_HEIGHT + 8;
    } else {
      for (const entry of linkEntries) {
        y = checkPageBreak(doc, y, LINE_HEIGHT * 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FONT_BODY);
        doc.setTextColor(...PRIMARY);
        doc.text(entry.label, PAGE_MARGIN_X, y);
        doc.setFont("helvetica", "normal");
        y += LINE_HEIGHT + 2;
        y = addLinkedUrlLines(doc, entry.url, PAGE_MARGIN_X, y, contentMaxWidth(doc));
        y += 6;
      }
    }

    // --- Resume (stored URL only; same semantics as profile page) ---
    // const resumeUrl = student?.resume?.resumeUrl || student?.resume?.filePath || "";
    // if (resumeUrl && String(resumeUrl).trim()) {
    //   y = addSectionTitle(doc, L.resume, y);
    //   const href = resolveResumeHref(String(resumeUrl).trim());
    //   doc.setFontSize(FONT_BODY);
    //   doc.setTextColor(...MUTED);
    //   y = addWrappedText(doc, "Resume file (link):", PAGE_MARGIN_X, y, contentMaxWidth(doc));
    //   doc.setTextColor(...PRIMARY);
    //   if (href) {
    //     y = addLinkedUrlLines(doc, href, PAGE_MARGIN_X, y + 1, contentMaxWidth(doc));
    //   } else {
    //     y = addWrappedText(doc, String(resumeUrl), PAGE_MARGIN_X, y + 1, contentMaxWidth(doc));
    //   }
    // }

    drawFooterPages(doc);

    const filename = `${sanitizeFilenamePart(displayName)}_${sanitizeFilenamePart(sid || "profile")}.pdf`;
    doc.save(filename);

    console.log("[PDF ✓] Successfully generated PDF:", filename);
    return { success: true, filename };
  } catch (error) {
    console.error("[PDF GENERATION ERROR]", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

export const generateStudentProfilePdf = generateStudentProfilePDF;
