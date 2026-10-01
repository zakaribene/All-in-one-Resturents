// This restaurant's shift runs 3:00 PM to roughly 1:00 AM (Africa/Mogadishu, fixed
// +03:00 — see the matching reasoning that used to live on reportRange() directly).
// Closing after midnight meant a calendar-midnight "today" boundary split one night's
// business into two different days — an order rung in at 12:30 AM showed up as
// "tomorrow" everywhere (Dashboard, wallet Today, Sales Report) even though the same
// shift that started at 3 PM was still open. Anchoring "today" to 3 PM instead keeps a
// whole shift on one day, matching how the restaurant actually thinks about "today".
const BUSINESS_DAY_START_HOUR = 15;

function pad2(n) { return String(n).padStart(2, '0'); }

// Mogadishu calendar date (Y, M, D, H) for an instant, independent of the host's own
// timezone — shift by the fixed offset and read back with UTC getters.
function mogadishuParts(at) {
  const m = new Date(at.getTime() + 3 * 60 * 60 * 1000);
  return { y: m.getUTCFullYear(), mo: m.getUTCMonth(), d: m.getUTCDate(), h: m.getUTCHours() };
}

// The Date (instant) marking the start of the CURRENT business day — 3 PM today if
// it's already past 3 PM Mogadishu time, otherwise 3 PM yesterday (last night's shift,
// still "today" until the next 3 PM rollover).
function businessDayStart(at = new Date()) {
  const { y, mo, d, h } = mogadishuParts(at);
  const dayOffset = h < BUSINESS_DAY_START_HOUR ? -1 : 0;
  const base = new Date(Date.UTC(y, mo, d + dayOffset));
  const yy = base.getUTCFullYear(), mm = pad2(base.getUTCMonth() + 1), dd = pad2(base.getUTCDate());
  return new Date(`${yy}-${mm}-${dd}T${pad2(BUSINESS_DAY_START_HOUR)}:00:00.000+03:00`);
}

// Same shape as the old reportRange(): given plain "YYYY-MM-DD" from/to strings (what
// an <input type="date"> sends), returns the Mongo range those business days cover.
// Picking From=D To=D means "the business day labeled D" — the shift that STARTS at
// 3 PM on D and runs through 2:59:59.999 PM the next calendar day (matches
// businessDayStart(): at 1 AM the morning after D, "today" is still D).
function businessDayRange(fromStr, toStr) {
  const from = String(fromStr || '').slice(0, 10);
  const to = String(toStr || '').slice(0, 10);
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    range.$gte = new Date(`${from}T${pad2(BUSINESS_DAY_START_HOUR)}:00:00.000+03:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const [y, mo, d] = to.split('-').map(Number);
    const next = new Date(Date.UTC(y, mo - 1, d + 1));
    const nyy = next.getUTCFullYear(), nmm = pad2(next.getUTCMonth() + 1), ndd = pad2(next.getUTCDate());
    range.$lte = new Date(`${nyy}-${nmm}-${ndd}T${pad2(BUSINESS_DAY_START_HOUR - 1)}:59:59.999+03:00`);
  }
  return { from, to, range: (range.$gte || range.$lte) ? range : null };
}

module.exports = { BUSINESS_DAY_START_HOUR, businessDayStart, businessDayRange };
