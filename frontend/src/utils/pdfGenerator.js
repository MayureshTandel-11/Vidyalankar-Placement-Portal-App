import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate Student Profile PDF
 * Includes: Basic info, Academic, Technical Skills, Certifications, Projects, Professional Links
 * Excludes: Resume file
 *
 * Note: jspdf-autotable is imported as plugin, used via autoTable() function
 */
export const generateStudentProfilePDF = (student, enrollmentNumber) => {
  try {
    const doc = new jsPDF();
    let yPosition = 10;

    // Set colors
    const primaryColor = [51, 65, 85]; // slate-700
    const accentColor = [79, 70, 229]; // indigo-600
    const borderColor = [203, 213, 225]; // slate-300

    // Header with college branding
    doc.setFontSize(20);
    doc.setTextColor(...accentColor);
    doc.text("STUDENT PROFILE", 15, yPosition);

    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, yPosition);

    yPosition += 15;

    // Basic Information Section
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Basic Information", 15, yPosition);
    yPosition += 7;

    const basicInfo = [
      ["Name", student.name || "N/A"],
      ["Enrollment Number", enrollmentNumber || student.studentId || "N/A"],
      ["Email", student.email || "N/A"],
      ["Department", student.department || "N/A"],
      ["Phone", student.phone || "N/A"],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [["Field", "Value"]],
      body: basicInfo,
      theme: "grid",
      headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { textColor: primaryColor },
      alternateRowStyles: { fillColor: [245, 248, 250] },
      margin: { left: 15, right: 15 },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 100 } },
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // Academic Information
    if (student.academicInfo || student.year) {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text("Academic Information", 15, yPosition);
      yPosition += 7;

      const academicInfo = [
        ["Year", student.year || "N/A"],
        ["SSC Percentage", student.academicInfo?.sscPercentage || "N/A"],
        ["HSC Percentage", student.academicInfo?.hscPercentage || "N/A"],
        ["CGPA", student.academicInfo?.cgpa || "N/A"],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [["Field", "Value"]],
        body: academicInfo,
        theme: "grid",
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { textColor: primaryColor },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        margin: { left: 15, right: 15 },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 100 } },
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Technical Skills
    if (student.technicalSkills && student.technicalSkills.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text("Technical Skills", 15, yPosition);
      yPosition += 7;

      const skillsText = student.technicalSkills.join(", ");
      const splitSkills = doc.splitTextToSize(skillsText, 180);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(splitSkills, 15, yPosition);

      yPosition += splitSkills.length * 5 + 10;
    }

    // Professional Links
    if (
      student.professionalLinks?.linkedinProfile ||
      student.professionalLinks?.githubProfile ||
      student.professionalLinks?.almaShineProfile
    ) {
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text("Professional Links", 15, yPosition);
      yPosition += 7;

      const profileLinks = [];
      if (student.professionalLinks?.linkedinProfile) {
        profileLinks.push(["LinkedIn", student.professionalLinks.linkedinProfile]);
      }
      if (student.professionalLinks?.githubProfile) {
        profileLinks.push(["GitHub", student.professionalLinks.githubProfile]);
      }
      if (student.professionalLinks?.almaShineProfile) {
        profileLinks.push(["AlmaShine", student.professionalLinks.almaShineProfile]);
      }

      if (profileLinks.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [["Platform", "URL"]],
          body: profileLinks,
          theme: "grid",
          headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
          bodyStyles: { textColor: [79, 70, 229] },
          alternateRowStyles: { fillColor: [245, 248, 250] },
          margin: { left: 15, right: 15 },
          columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 100 } },
        });

        yPosition = doc.lastAutoTable.finalY + 10;
      }
    }

    // Certifications
    if (student.certifications && student.certifications.length > 0) {
      doc.addPage();
      yPosition = 10;

      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text("Certifications", 15, yPosition);
      yPosition += 7;

      const certData = student.certifications.map((cert) => [
        cert.title || "N/A",
        cert.issuer || "N/A",
        cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : "N/A",
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Certification", "Issuer", "Issue Date"]],
        body: certData,
        theme: "grid",
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { textColor: primaryColor },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        margin: { left: 15, right: 15 },
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Projects
    if (student.projects && student.projects.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 10;
      }

      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text("Projects", 15, yPosition);
      yPosition += 7;

      const projectData = student.projects.map((proj) => [
        proj.title || "N/A",
        proj.description || "N/A",
        proj.technologies?.join(", ") || "N/A",
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Title", "Description", "Technologies"]],
        body: projectData,
        theme: "grid",
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { textColor: primaryColor },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        margin: { left: 15, right: 15 },
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Generate filename
    const filename = `${student.name || "student"}_${enrollmentNumber || "profile"}.pdf`;

    // Download PDF
    doc.save(filename);

    console.log("[PDF ✓] Successfully generated PDF:", filename);
    return { success: true, filename };
  } catch (error) {
    console.error("[PDF GENERATION ERROR]", error);
    throw new Error("Failed to generate PDF: " + error.message);
  }
};
