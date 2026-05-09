/**
 * Date utility functions for consistent date handling
 * All dates are normalized to start of day (00:00:00) for comparisons
 * Timezone-safe: Uses LOCAL time, normalized to start of day for comparison
 *
 * Core rule:
 *   lastDate = today  → "active"   (opportunity valid through entire day)
 *   lastDate < today  → "archived" (strictly yesterday or earlier)
 */

/**
 * Safely parse any supported date input into a local-midnight Date object.
 *
 * Supported formats:
 *   - "YYYY-MM-DD"                 → parsed as local midnight directly
 *   - ISO string "...T...Z" / "...T...+05:30"
 *                                  → converted to local date, then midnight
 *   - Date object                  → local date extracted, then midnight
 *
 * WHY NOT `new Date("YYYY-MM-DD")` directly?
 *   The spec treats bare date strings as UTC midnight, so in IST (+5:30)
 *   "2026-04-22" becomes April 22 00:00 UTC = April 22 05:30 IST.
 *   setHours(0,0,0,0) then still gives April 22 local midnight — correct
 *   by accident. We use explicit year/month/day extraction to be safe and
 *   intentional across all environments.
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {Date|null} Date at 00:00:00.000 local time, or null
 */
const parseDateToLocalMidnight = (dateInput) => {
  if (!dateInput) return null;

  let year, month, day;

  if (dateInput instanceof Date) {
    // Extract local calendar fields directly — no string conversion needed
    year  = dateInput.getFullYear();
    month = dateInput.getMonth();   // 0-indexed
    day   = dateInput.getDate();
  } else if (typeof dateInput === "string") {
    // Detect bare "YYYY-MM-DD" vs full ISO string
    const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput);

    if (bareDate) {
      // Parse manually to guarantee local midnight (avoids the UTC-midnight trap)
      const parts = dateInput.split("-");
      year  = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // convert to 0-indexed
      day   = parseInt(parts[2], 10);
    } else {
      // Full ISO / other string: let the engine parse it, then extract LOCAL fields
      // e.g. "2026-04-23T00:00:00.000Z" in IST → local April 23 05:30 → we take Apr 23
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) {
        console.warn("[DATE_UTILS] parseDateToLocalMidnight: Could not parse:", dateInput);
        return null;
      }
      year  = d.getFullYear();
      month = d.getMonth();
      day   = d.getDate();
    }
  } else {
    console.warn("[DATE_UTILS] parseDateToLocalMidnight: Unsupported type:", typeof dateInput, dateInput);
    return null;
  }

  // Construct local midnight — new Date(y, m, d) is always local midnight
  return new Date(year, month, day);
};

/**
 * Get today at local midnight (00:00:00.000).
 * Used as the reference point for all "is this past/future?" checks.
 *
 * @returns {Date} Today at 00:00:00 local time
 */
const getTodayStart = () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  console.log(`[DATE_UTILS] getTodayStart: ${todayStart.toISOString().split("T")[0]} (ts: ${todayStart.getTime()})`);
  return todayStart;
};

/**
 * Normalize any date input to local midnight.
 * Thin public wrapper around parseDateToLocalMidnight with logging.
 *
 * @param {string|Date|null} dateInput
 * @returns {Date|null}
 */
const normalizeDateToStartOfDay = (dateInput) => {
  if (!dateInput) {
    console.log("[DATE_UTILS] normalizeDateToStartOfDay: null/undefined input");
    return null;
  }

  const normalized = parseDateToLocalMidnight(dateInput);
  if (!normalized) return null;

  console.log("[DATE_UTILS] normalizeDateToStartOfDay:", {
    input: String(dateInput),
    normalized: normalized.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
    timestamp: normalized.getTime(),
  });

  return normalized;
};

/**
 * Check if a given (already-normalized) date is strictly in the past.
 *
 * "Past" means before today's local midnight — i.e. yesterday or earlier.
 * TODAY is NOT in the past.
 *
 * @param {Date} date - Should already be at local midnight
 * @returns {boolean}
 */
const isDateInPast = (date) => {
  const today = getTodayStart();
  // Strictly less-than: today itself returns false (not past)
  const isPast = date < today;

  console.log("[DATE_UTILS] isDateInPast:", {
    checkDate: date.toISOString().split("T")[0],
    today: today.toISOString().split("T")[0],
    isPast,
  });

  return isPast;
};

/**
 * Determine opportunity status based on lastDate.
 *
 *   lastDate = today  → "active"   (valid through the whole day)
 *   lastDate < today  → "archived" (strictly in the past)
 *   lastDate = null   → "active"   (no expiry)
 *
 * FIX NOTES vs previous version:
 *   1. Removed the erroneous `now.setDate(now.getDate() + 1)` that shifted
 *      "today" forward by one day, causing same-day dates to be archived.
 *   2. Removed double-parse (was constructing `new Date(lastDate)` before
 *      the type-check branches, wasting work and risking UTC-offset issues).
 *   3. ISO strings are now handled explicitly via parseDateToLocalMidnight.
 *
 * @param {Date|string|null|undefined} lastDate
 * @returns {"active"|"archived"}
 */
const getStatusFromLastDate = (lastDate) => {
  if (!lastDate) {
    console.log("[DATE_UTILS] getStatusFromLastDate: No lastDate provided → 'active'");
    return "active";
  }

  const todayMidnight = getTodayStart();                     // local midnight today
  const lastMidnight  = parseDateToLocalMidnight(lastDate);  // local midnight of lastDate

  if (!lastMidnight) {
    console.warn("[DATE_UTILS] getStatusFromLastDate: Could not parse lastDate, defaulting → 'active'");
    return "active";
  }

  //    lastDate == today  → todayMidnight > lastMidnight is FALSE → "active" ✓
  //    lastDate < today   → todayMidnight > lastMidnight is TRUE  → "archived" ✓
  const status = todayMidnight > lastMidnight ? "archived" : "active";

  console.log("[DATE_UTILS] getStatusFromLastDate:", {
    rawInput: String(lastDate),
    today: todayMidnight.toISOString().split("T")[0],
    lastDate: lastMidnight.toISOString().split("T")[0],
    todayTs: todayMidnight.getTime(),
    lastTs: lastMidnight.getTime(),
    sameDay: todayMidnight.getTime() === lastMidnight.getTime(),
    result: status,
  });

  return status;
};

module.exports = {
  getTodayStart,
  normalizeDateToStartOfDay,
  isDateInPast,
  getStatusFromLastDate,
};
