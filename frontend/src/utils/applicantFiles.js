export const sanitizeFilenameForOS = (name, maxLength = 200) => {
  let sanitized = String(name || "file")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) sanitized = "file";
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }
  return sanitized;
};

export const getApplicantsCsvFilename = (announcementHeading) =>
  `${sanitizeFilenameForOS(announcementHeading || "opportunity")}.csv`;

export const getResumesZipFilename = (announcementHeading) =>
  `${sanitizeFilenameForOS(announcementHeading || "opportunity")}_Resumes.zip`;

export const parseContentDispositionFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseEmailList = (value) => {
  if (!value || !String(value).trim()) return [];
  return String(value)
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
};

export const validateEmailList = (emails, label) => {
  for (const email of emails) {
    if (!EMAIL_REGEX.test(email)) {
      return `${label} contains an invalid email address: ${email}`;
    }
  }
  return null;
};
