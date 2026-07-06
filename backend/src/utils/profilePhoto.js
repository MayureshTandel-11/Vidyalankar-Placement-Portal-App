const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const normalizePhotoContentType = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "image/jpg") return "image/jpeg";
  return s;
};

const isAllowedProfilePhotoMime = (mime) => {
  const normalizedMime = normalizePhotoContentType(mime);
  return ALLOWED_PROFILE_PHOTO_MIME.has(normalizedMime);
};

const isAllowedProfilePhotoFileName = (fileName) => {
  const safeName = String(fileName || "").trim().toLowerCase();
  if (!safeName) return false;
  return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif)$/i.test(safeName);
};

module.exports = {
  MAX_PROFILE_PHOTO_BYTES,
  ALLOWED_PROFILE_PHOTO_MIME,
  normalizePhotoContentType,
  isAllowedProfilePhotoMime,
  isAllowedProfilePhotoFileName,
};
