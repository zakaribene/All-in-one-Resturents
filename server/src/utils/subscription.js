// A restaurant with no subscriptionEndsAt is "not tracked yet" — treated as always
// active so existing installs keep working until admin opts them in.
//
// While grace is running, it wins outright. Once it has passed, control falls back to
// subscriptionEndsAt IF one is set — a still-valid future subscription is never locked
// out by a stale grace field. Only when there's no real subscriptionEndsAt at all does
// a missed grace deadline itself become "expired" — that's what lets "Grant grace
// period" double as a standalone "pay within X or you're locked out" tool, not just a
// post-expiry extension. Renewing or clearing grace (admin.js) always resets
// graceEndsAt to null, so this stale-grace fallback normally never gets exercised.
function subscriptionStatus(r) {
  const now = Date.now();
  if (r?.graceEndsAt && new Date(r.graceEndsAt).getTime() > now) return 'grace';
  if (r?.subscriptionEndsAt) return new Date(r.subscriptionEndsAt).getTime() > now ? 'active' : 'expired';
  return r?.graceEndsAt ? 'expired' : 'active';
}

function isSubscriptionExpired(r) {
  return subscriptionStatus(r) === 'expired';
}

module.exports = { subscriptionStatus, isSubscriptionExpired };
