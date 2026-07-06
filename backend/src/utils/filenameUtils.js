/**
 * Sanitize a string for use as a filename (preserves spaces).
 * Removes characters invalid on Windows/macOS/Linux file systems.
 */
const sanitizeFilenameForOS = (name, maxLength = 200) => {
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

module.exports = { sanitizeFilenameForOS };
