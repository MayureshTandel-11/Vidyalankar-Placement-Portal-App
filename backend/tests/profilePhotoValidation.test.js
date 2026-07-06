const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_PROFILE_PHOTO_BYTES, normalizePhotoContentType, isAllowedProfilePhotoMime, isAllowedProfilePhotoFileName } = require("../src/utils/profilePhoto");

test("accepts common profile image formats and 5MB limit", () => {
  assert.equal(MAX_PROFILE_PHOTO_BYTES, 5 * 1024 * 1024);
  assert.equal(normalizePhotoContentType("image/jpg"), "image/jpeg");
  assert.equal(normalizePhotoContentType("image/WEBP"), "image/webp");
  assert.equal(isAllowedProfilePhotoMime("image/avif"), true);
  assert.equal(isAllowedProfilePhotoMime("image/svg+xml"), true);
  assert.equal(isAllowedProfilePhotoMime("image/heic"), true);
  assert.equal(isAllowedProfilePhotoMime("image/gif"), true);
  assert.equal(isAllowedProfilePhotoMime("text/plain"), false);
  assert.equal(isAllowedProfilePhotoFileName("photo.webp"), true);
  assert.equal(isAllowedProfilePhotoFileName("photo.svg"), true);
  assert.equal(isAllowedProfilePhotoFileName("document.pdf"), false);
});
