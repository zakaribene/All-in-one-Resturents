// A restaurant with no subscriptionEndsAt is "not tracked yet" — treated as always
// active so existing installs keep working until admin opts them in.
//
// A still-running subscription always wins first: a grace period granted ahead of time
// (e.g. bundled with a renewal, via admin.js's `max(now, subscriptionEndsAt)` grace
// formula) stays dormant — no banner, no lockout — until subscriptionEndsAt itself
// passes. That's what lets the admin pre-schedule "N extra days after this subscription
// ends" using the exact same Grant grace period form, instead of it firing immediately.
//
// Once the subscription has actually ended (or there isn't one), grace takes over while
// it's running. Once grace has also passed, control falls back to subscriptionEndsAt IF
// one is set — a still-valid future subscription (shouldn't happen here, but defensively)
// is never locked out by a stale grace field. Only when there's no real subscriptionEndsAt
// at all does a missed grace deadline itself become "expired" — that's what lets "Grant
// grace period" double as a standalone "pay within X or you're locked out" tool, not just
// a post-expiry extension. Renewing or clearing grace (admin.js) always resets graceEndsAt
// to null, so this stale-grace fallback normally never gets exercised.
function subscriptionStatus(r) {
  const now = Date.now();
  const subEndsAtMs = r?.subscriptionEndsAt ? new Date(r.subscriptionEndsAt).getTime() : null;
  if (subEndsAtMs !== null && subEndsAtMs > now) return 'active';
  if (r?.graceEndsAt && new Date(r.graceEndsAt).getTime() > now) return 'grace';
  if (subEndsAtMs !== null) return 'expired';
  return r?.graceEndsAt ? 'expired' : 'active';
}

function isSubscriptionExpired(r) {
  return subscriptionStatus(r) === 'expired';
}

// Powers the super admin's "Subscriptions expiring soon" list (Overview widget + full
// Subscriptions page list). One unified list rather than three separate ones: already
// expired (most urgent — sorts first since its endsAt is in the past), running grace
// periods (endsAt = when the grace itself runs out), and still-active subscriptions
// whose subscriptionEndsAt falls within the `days` window. A suspended restaurant is
// already manually taken offline by the admin, so it's excluded — nothing to act on.
function expiringSoonList(restaurants, days = 7) {
  const now = Date.now();
  const windowEnd = now + Math.max(1, Number(days) || 7) * 86400 * 1000;
  const rows = [];
  for (const r of restaurants) {
    if (r.status === 'suspended') continue;
    const status = subscriptionStatus(r);
    if (status === 'active') {
      if (!r.subscriptionEndsAt) continue; // untracked — never "expiring"
      if (new Date(r.subscriptionEndsAt).getTime() > windowEnd) continue;
      rows.push({ id: r._id, name: r.name, owner: r.ownerName, status, endsAt: r.subscriptionEndsAt });
    } else if (status === 'grace') {
      rows.push({ id: r._id, name: r.name, owner: r.ownerName, status, endsAt: r.graceEndsAt });
    } else if (status === 'expired') {
      rows.push({ id: r._id, name: r.name, owner: r.ownerName, status, endsAt: r.subscriptionEndsAt || null });
    }
  }
  rows.sort((a, b) => new Date(a.endsAt || 0).getTime() - new Date(b.endsAt || 0).getTime());
  return rows;
}

module.exports = { subscriptionStatus, isSubscriptionExpired, expiringSoonList };
