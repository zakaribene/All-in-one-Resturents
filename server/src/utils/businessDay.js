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

// "YYYY-MM" label of the business month an instant falls in — the calendar month of
// its business-day date (see businessDayStart). This is how "which accounting month is
// it right now" is determined for wallet balances and the Reports month filter: the 1st
// of the month doesn't flip over until that day's own 3 PM business-day boundary passes.
function businessMonthKey(at = new Date()) {
  const start = businessDayStart(at);
  const m = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return `${m.getUTCFullYear()}-${pad2(m.getUTCMonth() + 1)}`;
}

// Mongo range `{$gte, $lt}` covering one accounting month ("YYYY-MM", as returned by
// businessMonthKey): from 3 PM Mogadishu on the 1st through 2:59:59.999 PM on the 1st of
// the following month — so a month boundary lines up exactly with businessMonthKey's own
// rollover instant, and wraps correctly from December into the next January. Returns null
// for a malformed key instead of throwing, since callers may pass this straight through
// from a query string.
function businessMonthRange(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  const start = new Date(`${m[1]}-${m[2]}-01T${pad2(BUSINESS_DAY_START_HOUR)}:00:00.000+03:00`);
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const end = new Date(`${nextY}-${pad2(nextMo)}-01T${pad2(BUSINESS_DAY_START_HOUR)}:00:00.000+03:00`);
  return { $gte: start, $lt: end };
}

// "YYYY-MM" shifted by `delta` whole months (negative goes backward), wrapping the year
// correctly in either direction. Returns null for a malformed key.
function addMonthsToKey(monthKey, delta) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!m) return null;
  let total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12;
  return `${y}-${pad2(mo + 1)}`;
}

module.exports = {
  BUSINESS_DAY_START_HOUR, businessDayStart, businessDayRange,
  businessMonthKey, businessMonthRange, addMonthsToKey,
};
