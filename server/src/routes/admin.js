const express = require('express');
const bcrypt = require('bcryptjs');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const AdminUser = require('../models/AdminUser');
const PaymentAccount = require('../models/PaymentAccount');
const SmsAccount = require('../models/SmsAccount');
const SupportMessage = require('../models/SupportMessage');
const { requireAdmin, signToken } = require('../middleware/auth');
const { makeTableCode, slugify } = require('../utils/codes');
const { emitToRestaurant, emitToAllRestaurants, emitToAdmin } = require('../socket');
const { encrypt, decrypt } = require('../utils/crypto');
const { dataSummary, purgeData } = require('../utils/restaurantData');
const { subscriptionStatus, expiringSoonList } = require('../utils/subscription');
const { logActivity, MODULE_LABEL } = require('../utils/activityLog');
const { getRetentionSetting, setRetentionSetting } = require('../utils/activityRetention');
const { getSupportRetentionSetting, setSupportRetentionSetting } = require('../utils/supportRetention');
const { buildXlsx, buildPdf, fmtDate } = require('../utils/reportExport');
const { upload } = require('../utils/upload');

// Every admin.js Activity.create() call below is on behalf of the super admin acting on
// a restaurant, so the actor is always req.auth.name (the signed-in admin), never the
// restaurant owner.
function adminName(req) { return req.auth?.name || 'Super Admin'; }

const router = express.Router();
router.use(requireAdmin);

router.get('/me', async (req, res) => {
  const admin = await AdminUser.findById(req.auth.id).lean();
  if (!admin) return res.status(404).json({ error: 'Not found' });
  res.json({ id: admin._id, username: admin.username, name: admin.name });
});

router.patch('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const admin = await AdminUser.findById(req.auth.id);
  if (!admin) return res.status(404).json({ error: 'Not found' });
  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
  admin.passwordHash = await bcrypt.hash(newPassword, 10);
  await admin.save();
  res.json({ ok: true });
});

router.get('/overview', async (req, res) => {
  const restaurants = await Restaurant.find().lean();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const ordersByRestaurant = await Order.aggregate([
    { $match: { createdAt: { $gte: since30 } } },
    { $group: { _id: '$restaurant', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(ordersByRestaurant.map(r => [String(r._id), r.count]));

  const [ordersTodayCount, revenue30dAgg] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfToday } }),
    Order.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
  ]);
  const revenue30d = revenue30dAgg[0]?.sum || 0;
  const activeRest = restaurants.filter(r => r.status === 'active').length;

  const stats = [
    { so: 'Maqaayado', en: 'Restaurants', val: String(restaurants.length), sub: `${activeRest} active`, tone: 'accent' },
    { so: 'Dalabyada maanta', en: 'Orders today', val: String(ordersTodayCount), sub: '', tone: '#12A150' },
    { so: 'Dakhliga (30d)', en: 'Revenue', val: '$' + revenue30d.toFixed(2), sub: 'Payments — soon', tone: '#8B5CF6' },
    { so: 'Users firfircoon', en: 'Active staff', val: String(activeRest), sub: 'across all venues', tone: '#E8A317' },
  ];

  // Top 8 by volume — this chart answers "who's driving orders," not "list every
  // restaurant" (the Restaurants page already does that), so a long zero-order tail
  // doesn't belong here. One hue (accent) throughout: this is a single-measure ranking,
  // not multiple identity-bearing series, so length is the only encoder color should carry.
  const ranked = [...restaurants]
    .map(r => ({ name: r.name, orders: countMap.get(String(r._id)) || 0 }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 8);
  const maxCount = Math.max(1, ...ranked.map(r => r.orders));
  const chartRows = ranked.map(r => ({
    name: r.name, orders: r.orders, ordStr: r.orders.toLocaleString(),
    barW: ((r.orders / maxCount) * 100).toFixed(0) + '%',
  }));

  const activity = await Activity.find().sort({ createdAt: -1 }).limit(6).lean();
  const expiring = expiringSoonList(restaurants, 7);

  res.json({
    stats, chartRows,
    activity: activity.map(a => ({ t: a.message, d: timeAgo(a.createdAt), dot: a.dot })),
    expiringSoon: expiring.slice(0, 5),
    expiringSoonCount: expiring.length,
  });
});

function timeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.round(hrs / 24) + 'd ago';
}

router.get('/restaurants', async (req, res) => {
  const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: since30 } } },
    { $group: { _id: '$restaurant', orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
  ]);
  const map = new Map(agg.map(a => [String(a._id), a]));
  res.json(restaurants.map(r => {
    const m = map.get(String(r._id)) || { orders: 0, revenue: 0 };
    return {
      id: r._id, name: r.name, city: r.city, owner: r.ownerName, username: r.username, plan: r.plan, status: r.status,
      orderingEnabled: r.orderingEnabled !== false, supportEnabled: !!r.supportEnabled,
      subscriptionStatus: subscriptionStatus(r),
      hue: r.hue, orders: m.orders, revenue: '$' + m.revenue.toFixed(2),
      lastLoginAt: r.lastLoginAt || null, lastSeenAt: r.lastSeenAt || null,
    };
  }));
});

router.post('/restaurants', async (req, res) => {
  const { name, city, ownerName, username, password, plan } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password are required' });
  const existing = await Restaurant.findOne({ username: String(username).trim().toLowerCase() });
  if (existing) return res.status(409).json({ error: 'Username already taken' });
  const passwordHash = await bcrypt.hash(password, 10);
  const restaurant = await Restaurant.create({
    name, city: city || '', ownerName: ownerName || '',
    username: String(username).trim().toLowerCase(), passwordHash,
    plan: plan || 'Free',
  });
  await Table.create([
    { restaurant: restaurant._id, label: 'Takeaway', type: 'takeaway', code: makeTableCode() },
    { restaurant: restaurant._id, label: 'Online', type: 'online', code: makeTableCode() },
  ]);
  logActivity({
    restaurant: restaurant._id, userName: adminName(req), module: 'restaurant', action: 'Create',
    message: `${restaurant.name} joined · ${restaurant.plan} plan`,
  });
  res.status(201).json({ id: restaurant._id });
});

router.get('/restaurants/:id', async (req, res) => {
  const r = await Restaurant.findById(req.params.id).lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const [orderCount, revenueAgg] = await Promise.all([
    Order.countDocuments({ restaurant: r._id }),
    Order.aggregate([{ $match: { restaurant: r._id } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
  ]);
  res.json({
    id: r._id, name: r.name, city: r.city, owner: r.ownerName, username: r.username,
    plan: r.plan, status: r.status, orderingEnabled: r.orderingEnabled !== false, supportEnabled: !!r.supportEnabled, hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl,
    orders: orderCount, revenue: '$' + (revenueAgg[0]?.sum || 0).toFixed(2), createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt || null, lastSeenAt: r.lastSeenAt || null,
  });
});

router.patch('/restaurants/:id', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { name, city, ownerName, username, plan } = req.body || {};

  if (username != null) {
    const clean = String(username).trim().toLowerCase();
    if (!clean) return res.status(400).json({ error: 'Username cannot be empty' });
    if (clean !== r.username) {
      const taken = await Restaurant.findOne({ username: clean, _id: { $ne: r._id } });
      if (taken) return res.status(409).json({ error: 'Username already taken' });
      r.username = clean;
    }
  }
  if (name != null) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    r.name = String(name).trim();
  }
  if (city != null) r.city = String(city).trim();
  if (ownerName != null) r.ownerName = String(ownerName).trim();

  let planChanged = false;
  if (plan != null && plan !== r.plan) {
    if (!['Free', 'Basic', 'Pro'].includes(plan)) return res.status(400).json({ error: 'plan must be Free, Basic, or Pro' });
    r.plan = plan;
    planChanged = true;
  }

  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'restaurant', action: 'Update',
    message: planChanged ? `${r.name} moved to ${r.plan} plan by admin` : `${r.name} details updated by admin`,
  });
  res.json({ ok: true });
});

router.patch('/restaurants/:id/toggle', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = r.status === 'active' ? 'suspended' : 'active';
  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'restaurant', action: 'Update',
    message: `${r.name} ${r.status === 'suspended' ? 'suspended' : 'activated'}`,
  });
  res.json({ id: r._id, status: r.status });
});

router.patch('/restaurants/:id/ordering-toggle', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.orderingEnabled = !(r.orderingEnabled !== false);
  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'qr', action: 'Update',
    message: `${r.name} QR/online ordering ${r.orderingEnabled ? 'enabled' : 'disabled'} by admin`,
  });
  res.json({ id: r._id, orderingEnabled: r.orderingEnabled });
});

router.patch('/restaurants/:id/support-toggle', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.supportEnabled = !r.supportEnabled;
  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'support', action: 'Update',
    message: `${r.name} Support Inbox ${r.supportEnabled ? 'enabled' : 'disabled'} by admin`,
  });
  res.json({ id: r._id, supportEnabled: r.supportEnabled });
});

// Impersonation: lets the super admin view a restaurant's own dashboard without
// its password. Short-lived (2h) and stamped with `impersonatedBy` so /restaurant/me
// can tell the owner dashboard it's an admin session (banner + "return to admin").
router.post('/restaurants/:id/login-as', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const token = signToken({ role: 'restaurant', id: r._id.toString(), impersonatedBy: req.auth.id, name: r.ownerName || r.name }, '2h');
  logActivity({ restaurant: r._id, userName: adminName(req), module: 'auth', action: 'Login', message: `Admin logged in as ${r.name}` });
  res.json({
    token,
    restaurant: { id: r._id, name: r.name, city: r.city, plan: r.plan, hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl },
  });
});

// ---- Subscriptions (renew / grace period) ----
const GRACE_COLORS = ['orange', 'red', 'purple', 'blue', 'green', 'pink'];

// Pushes the new subscription state straight into an already-open dashboard tab (picked
// up by RestaurantLayout's socket listener) so the banner appears/updates/disappears
// live — the owner never has to refresh to see what the admin just did.
function emitSubscriptionUpdate(r) {
  emitToRestaurant(r._id, 'subscription:updated', {
    subscriptionStatus: subscriptionStatus(r),
    subscriptionEndsAt: r.subscriptionEndsAt || null,
    graceEndsAt: r.graceEndsAt || null,
    graceMessage: r.graceMessage || '',
    graceColor: r.graceColor || 'orange',
  });
}

// Full "Subscriptions expiring soon" list for the Subscriptions page — the compact
// version on Overview is computed inline there from the same expiringSoonList() helper.
router.get('/subscriptions/expiring', async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days) || 7));
  const restaurants = await Restaurant.find().select('name ownerName username status subscriptionEndsAt graceEndsAt').lean();
  const rows = expiringSoonList(restaurants, days);
  res.json({ days, rows });
});

router.get('/restaurants/:id/subscription', async (req, res) => {
  const r = await Restaurant.findById(req.params.id).lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: r._id, name: r.name, owner: r.ownerName,
    status: subscriptionStatus(r),
    subscriptionEndsAt: r.subscriptionEndsAt || null,
    graceEndsAt: r.graceEndsAt || null,
    graceMessage: r.graceMessage || '',
    graceColor: r.graceColor || 'orange',
  });
});

router.patch('/restaurants/:id/subscription/renew', async (req, res) => {
  const { newEndsAt } = req.body || {};
  const date = new Date(newEndsAt);
  if (!newEndsAt || Number.isNaN(date.getTime())) return res.status(400).json({ error: 'A valid newEndsAt date is required' });
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.subscriptionEndsAt = date;
  // Payment received — any lingering grace countdown is now moot.
  r.graceEndsAt = null;
  r.graceMessage = '';
  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'subscription', action: 'Update',
    message: `${r.name}: subscription renewed until ${date.toLocaleDateString()} by admin`,
  });
  emitSubscriptionUpdate(r);
  res.json({ id: r._id, status: subscriptionStatus(r), subscriptionEndsAt: r.subscriptionEndsAt });
});

router.patch('/restaurants/:id/subscription/grace', async (req, res) => {
  const { days, hours, minutes, message, color } = req.body || {};
  const totalMs = (Math.max(0, Number(days) || 0) * 86400 + Math.max(0, Number(hours) || 0) * 3600 + Math.max(0, Number(minutes) || 0) * 60) * 1000;
  if (totalMs <= 0) return res.status(400).json({ error: 'Enter at least some days, hours, or minutes' });
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return res.status(400).json({ error: 'Banner message is required' });
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  // Counts from whichever is later: "now" (subscription already expired, or none set —
  // takes effect immediately) or the current subscriptionEndsAt (subscription still
  // running — the same form doubles as "give N extra days once this renewal runs out",
  // and subscriptionStatus() keeps it dormant/no-banner until that date actually arrives).
  const subEndsAtMs = r.subscriptionEndsAt ? new Date(r.subscriptionEndsAt).getTime() : 0;
  const base = Math.max(Date.now(), subEndsAtMs);
  const pending = base > Date.now();
  r.graceEndsAt = new Date(base + totalMs);
  r.graceMessage = cleanMessage;
  if (GRACE_COLORS.includes(color)) r.graceColor = color;
  await r.save();
  logActivity({
    restaurant: r._id, userName: adminName(req), module: 'subscription', action: 'Update',
    message: pending
      ? `${r.name}: grace period scheduled — starts when subscription ends (${r.subscriptionEndsAt.toLocaleString()}), runs until ${r.graceEndsAt.toLocaleString()} · by admin`
      : `${r.name}: grace period granted until ${r.graceEndsAt.toLocaleString()} by admin`,
  });
  emitSubscriptionUpdate(r);
  res.json({
    id: r._id, status: subscriptionStatus(r), graceEndsAt: r.graceEndsAt, graceMessage: r.graceMessage, graceColor: r.graceColor,
  });
});

router.patch('/restaurants/:id/subscription/clear-grace', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.graceEndsAt = null;
  r.graceMessage = '';
  await r.save();
  logActivity({ restaurant: r._id, userName: adminName(req), module: 'subscription', action: 'Update', message: `${r.name}: grace banner cleared by admin` });
  emitSubscriptionUpdate(r);
  res.json({ id: r._id, status: subscriptionStatus(r) });
});

router.patch('/restaurants/:id/password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.passwordHash = await bcrypt.hash(newPassword, 10);
  await r.save();
  logActivity({ restaurant: r._id, userName: adminName(req), module: 'settings', action: 'Update', message: `${r.name} password was reset by admin` });
  res.json({ ok: true });
});

// Lists every tenant-scoped collection (auto-discovered — see utils/restaurantData.js)
// with a live document count for this one restaurant, for the admin data-wipe tool.
router.get('/restaurants/:id/data', async (req, res) => {
  const r = await Restaurant.findById(req.params.id).select('name username').lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const items = await dataSummary(req.params.id);
  res.json({ restaurant: { id: r._id, name: r.name, username: r.username }, items });
});

router.post('/restaurants/:id/data/purge', async (req, res) => {
  const r = await Restaurant.findById(req.params.id).select('name').lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'No collections selected' });
  const results = await purgeData(req.params.id, ids);
  const deletedAccount = results.some((res) => res.id === 'Restaurant' && res.deletedCount > 0);
  logActivity({
    restaurant: deletedAccount ? null : r._id, userName: adminName(req), module: 'data', action: 'Delete',
    message: `${r.name}: admin purged ${results.map((x) => `${x.label} (${x.deletedCount})`).join(', ')}`,
  });
  res.json({ results });
});

router.post('/notifications', async (req, res) => {
  const { target, restaurantId, title, body } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title required' });
  if (target === 'single' && !restaurantId) return res.status(400).json({ error: 'restaurantId required for single target' });

  const notif = await Notification.create({
    scope: target === 'single' ? 'single' : 'all',
    restaurant: target === 'single' ? restaurantId : null,
    title: title.trim(), body: body || '',
  });

  const payload = { id: notif._id, title: notif.title, body: notif.body, createdAt: notif.createdAt };
  if (target === 'single') emitToRestaurant(restaurantId, 'notification:new', payload);
  else emitToAllRestaurants('notification:new', payload);

  res.status(201).json({ id: notif._id });
});

// ---- Payment accounts (WaafiPay: EVC Plus / ZAAD / eDahab) ----
function maskAccount(a) {
  return {
    id: a._id, provider: a.provider, label: a.label, baseUrl: a.baseUrl, merchantUid: a.merchantUid,
    apiUserIdMasked: '••••' + decrypt(a.apiUserId).slice(-4),
    apiKeyMasked: '••••' + decrypt(a.apiKey).slice(-4),
    currency: a.currency, isPrimary: a.isPrimary, status: a.status, createdAt: a.createdAt,
  };
}

router.get('/restaurants/:id/payment-accounts', async (req, res) => {
  const accounts = await PaymentAccount.find({ restaurant: req.params.id }).lean();
  res.json(accounts.map(maskAccount));
});

router.post('/restaurants/:id/payment-accounts', async (req, res) => {
  const { provider, label, baseUrl, merchantUid, apiUserId, apiKey, currency, isPrimary } = req.body || {};
  if (!['evc', 'zaad', 'edahab'].includes(provider)) return res.status(400).json({ error: 'provider must be evc, zaad, or edahab' });
  if (!baseUrl || !merchantUid || !apiUserId || !apiKey) return res.status(400).json({ error: 'baseUrl, merchantUid, apiUserId, apiKey are required' });
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) return res.status(404).json({ error: 'Not found' });
  const existing = await PaymentAccount.findOne({ restaurant: restaurant._id, provider });
  if (existing) return res.status(409).json({ error: 'Provider already connected, edit or remove it first' });
  if (isPrimary) await PaymentAccount.updateMany({ restaurant: restaurant._id }, { isPrimary: false });
  const account = await PaymentAccount.create({
    restaurant: restaurant._id, provider, label: label || '', baseUrl: baseUrl.trim(), merchantUid,
    apiUserId: encrypt(apiUserId), apiKey: encrypt(apiKey),
    currency: currency || 'USD', isPrimary: !!isPrimary,
  });
  logActivity({ restaurant: restaurant._id, userName: adminName(req), module: 'payments', action: 'Create', message: `${restaurant.name}: ${label || provider} connected` });
  res.status(201).json({ id: account._id });
});

router.patch('/restaurants/:id/payment-accounts/:accountId', async (req, res) => {
  const account = await PaymentAccount.findOne({ _id: req.params.accountId, restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
  const { label, baseUrl, merchantUid, apiUserId, apiKey, currency, isPrimary, status } = req.body || {};
  if (label != null) account.label = label;
  if (baseUrl) account.baseUrl = baseUrl.trim();
  if (merchantUid) account.merchantUid = merchantUid;
  if (apiUserId) account.apiUserId = encrypt(apiUserId);
  if (apiKey) account.apiKey = encrypt(apiKey);
  if (currency) account.currency = currency;
  if (status && ['active', 'disabled'].includes(status)) account.status = status;
  if (isPrimary) {
    await PaymentAccount.updateMany({ restaurant: req.params.id, _id: { $ne: account._id } }, { isPrimary: false });
    account.isPrimary = true;
  } else if (isPrimary === false) {
    account.isPrimary = false;
  }
  await account.save();
  logActivity({ restaurant: req.params.id, userName: adminName(req), module: 'payments', action: 'Update', message: `${account.label || account.provider} payment account updated by admin` });
  res.json({ ok: true });
});

router.delete('/restaurants/:id/payment-accounts/:accountId', async (req, res) => {
  const account = await PaymentAccount.findOneAndDelete({ _id: req.params.accountId, restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
  logActivity({ restaurant: req.params.id, userName: adminName(req), module: 'payments', action: 'Delete', message: `${account.label || account.provider} payment account removed by admin` });
  res.json({ ok: true });
});

// ---- SMS account (Hormuud / Tabaarak) ----
const SMS_API_DEFAULTS = {
  hormuud: 'https://smsapi.hormuud.com/api/sms/Send',
  tabaarak: 'https://sms.tabaarak.com',
};

function maskSmsAccount(a) {
  return {
    id: a._id, provider: a.provider || 'hormuud',
    username: a.username ? '••••' + decrypt(a.username).slice(-3) : '',
    senderId: a.senderId, apiUrl: a.apiUrl, status: a.status, createdAt: a.createdAt,
  };
}

router.get('/restaurants/:id/sms-account', async (req, res) => {
  const account = await SmsAccount.findOne({ restaurant: req.params.id }).lean();
  res.json(account ? maskSmsAccount(account) : null);
});

router.post('/restaurants/:id/sms-account', async (req, res) => {
  const { username, password, senderId, apiUrl, provider } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  const cleanProvider = ['hormuud', 'tabaarak'].includes(provider) ? provider : 'hormuud';
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) return res.status(404).json({ error: 'Not found' });
  const existing = await SmsAccount.findOne({ restaurant: restaurant._id });
  if (existing) return res.status(409).json({ error: 'SMS already connected, edit or remove it first' });
  const account = await SmsAccount.create({
    restaurant: restaurant._id, provider: cleanProvider,
    username: encrypt(username), password: encrypt(password), senderId: senderId || '',
    apiUrl: (apiUrl && apiUrl.trim()) || SMS_API_DEFAULTS[cleanProvider],
  });
  logActivity({ restaurant: restaurant._id, userName: adminName(req), module: 'sms', action: 'Create', message: `${restaurant.name}: SMS connected` });
  res.status(201).json({ id: account._id });
});

router.patch('/restaurants/:id/sms-account', async (req, res) => {
  const account = await SmsAccount.findOne({ restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
  const { username, password, senderId, apiUrl, provider, status } = req.body || {};
  const providerChanged = ['hormuud', 'tabaarak'].includes(provider) && provider !== account.provider;
  if (providerChanged) account.provider = provider;
  if (username) account.username = encrypt(username);
  if (password) account.password = encrypt(password);
  if (senderId != null) account.senderId = senderId;
  if (apiUrl != null && apiUrl.trim()) account.apiUrl = apiUrl.trim();
  else if (apiUrl != null || providerChanged) account.apiUrl = SMS_API_DEFAULTS[account.provider];
  if (status && ['active', 'disabled'].includes(status)) account.status = status;
  await account.save();
  logActivity({ restaurant: req.params.id, userName: adminName(req), module: 'sms', action: 'Update', message: 'SMS account updated by admin' });
  res.json({ ok: true });
});

router.delete('/restaurants/:id/sms-account', async (req, res) => {
  const account = await SmsAccount.findOneAndDelete({ restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
  logActivity({ restaurant: req.params.id, userName: adminName(req), module: 'sms', action: 'Delete', message: 'SMS account removed by admin' });
  res.json({ ok: true });
});

// ---- Activity Log (every store) + retention policy ----

router.get('/settings/activity-retention', async (req, res) => {
  const s = await getRetentionSetting();
  res.json({ enabled: s.activityRetentionEnabled, days: s.activityRetentionDays });
});

router.patch('/settings/activity-retention', async (req, res) => {
  const { enabled, days } = req.body || {};
  if (days !== undefined && !(Number(days) > 0)) return res.status(400).json({ error: 'days must be a positive number' });
  const s = await setRetentionSetting({ enabled, days });
  res.json({ enabled: s.activityRetentionEnabled, days: s.activityRetentionDays });
});

const ACTIVITY_COLUMNS = [
  { header: 'Date', headerSo: 'Taariikh', key: 'date', w: 1.5, width: 18, format: 'datetime' },
  { header: 'Store', headerSo: 'Maqaayad', key: 'store', w: 1.3, width: 18 },
  { header: 'User', headerSo: 'Qofka', key: 'user', w: 1.2, width: 16 },
  { header: 'Module', headerSo: 'Module', key: 'module', w: 1, width: 14 },
  { header: 'Action', headerSo: 'Ficil', key: 'action', w: 0.9, width: 10 },
  { header: 'Description', headerSo: 'Faahfaahin', key: 'description', w: 3, width: 44, wrap: true },
];

// Shared by the JSON list and both export formats so filters never drift out of sync.
// No 'Z' suffix — see the matching comment on reportRange()/activityLogFilter() in
// restaurant.js. Keeps "today" here meaning the same thing it means everywhere else
// (server-local, Africa/Mogadishu in production), not UTC.
async function buildActivityLogQuery(req) {
  const q = req.query || {};
  const filter = {};
  if (q.restaurantId && q.restaurantId !== 'all') filter.restaurant = q.restaurantId;
  if (q.module && q.module !== 'all') filter.module = q.module;
  const from = String(q.from || '').slice(0, 10);
  const to = String(q.to || '').slice(0, 10);
  const createdAt = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) createdAt.$gte = new Date(from + 'T00:00:00.000');
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) createdAt.$lte = new Date(to + 'T23:59:59.999');
  if (createdAt.$gte || createdAt.$lte) filter.createdAt = createdAt;
  return { filter, from, to };
}

async function fetchActivityRows(filter, limit) {
  const list = await Activity.find(filter).sort({ createdAt: -1 }).limit(limit).populate('restaurant', 'name').lean();
  return list.map((a) => ({
    date: a.createdAt,
    store: a.restaurant?.name || '—',
    user: a.userName || '—',
    module: MODULE_LABEL[a.module] || a.module || '—',
    action: a.action || '—',
    description: a.message,
  }));
}

router.get('/activity-log', async (req, res) => {
  const { filter } = await buildActivityLogQuery(req);
  const rows = await fetchActivityRows(filter, 500);
  res.json({ rows, truncated: rows.length === 500, moduleOptions: Object.keys(MODULE_LABEL) });
});

router.get('/activity-log.xlsx', async (req, res) => {
  const { filter, from, to } = await buildActivityLogQuery(req);
  const rows = await fetchActivityRows(filter, 5000);
  const buf = await buildXlsx({
    restaurant: { name: 'Miis Platform', hue: 212 },
    reportName: 'Activity Log', reportNameSo: 'Diiwaanka Dhaqdhaqaaqa',
    filterLines: [`Range: ${from || '—'}  ->  ${to || '—'}`],
    columns: ACTIVITY_COLUMNS, rows,
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="activity-log_${fmtDate(new Date())}.xlsx"`);
  res.send(Buffer.from(buf));
});

router.get('/activity-log.pdf', async (req, res) => {
  const { filter, from, to } = await buildActivityLogQuery(req);
  const rows = await fetchActivityRows(filter, 5000);
  buildPdf({
    restaurant: { name: 'Miis Platform', hue: 212 },
    reportName: 'Activity Log', reportNameSo: 'Diiwaanka Dhaqdhaqaaqa',
    filterLines: [`Range: ${from || '—'}  ->  ${to || '—'}`],
    columns: ACTIVITY_COLUMNS, rows,
  }, res, `activity-log_${fmtDate(new Date())}.pdf`);
});

// ---- Support Inbox (chat with every store that has it enabled) + retention policy ----

function mapSupportMessage(m) {
  return { id: m._id, sender: m.sender, senderName: m.senderName, text: m.text, imageUrl: m.imageUrl, createdAt: m.createdAt };
}

router.get('/settings/support-retention', async (req, res) => {
  const s = await getSupportRetentionSetting();
  res.json({ enabled: s.supportRetentionEnabled, days: s.supportRetentionDays });
});

router.patch('/settings/support-retention', async (req, res) => {
  const { enabled, days } = req.body || {};
  if (days !== undefined && !(Number(days) > 0)) return res.status(400).json({ error: 'days must be a positive number' });
  const s = await setSupportRetentionSetting({ enabled, days });
  res.json({ enabled: s.supportRetentionEnabled, days: s.supportRetentionDays });
});

// One row per store with Support enabled — last message preview + unread count, so the
// inbox list reads like a normal chat app. Unread-first, then most recently active,
// then alphabetical for stores nobody has messaged yet (so they're still reachable).
router.get('/support/conversations', async (req, res) => {
  const restaurants = await Restaurant.find({ supportEnabled: true }).select('name ownerName username hue logoUrl').lean();
  const ids = restaurants.map((r) => r._id);
  const [lastMessages, unreadAgg] = await Promise.all([
    SupportMessage.aggregate([
      { $match: { restaurant: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$restaurant', text: { $first: '$text' }, imageUrl: { $first: '$imageUrl' }, createdAt: { $first: '$createdAt' }, sender: { $first: '$sender' } } },
    ]),
    SupportMessage.aggregate([
      { $match: { restaurant: { $in: ids }, sender: 'restaurant', readByAdmin: false } },
      { $group: { _id: '$restaurant', count: { $sum: 1 } } },
    ]),
  ]);
  const lastMap = new Map(lastMessages.map((m) => [String(m._id), m]));
  const unreadMap = new Map(unreadAgg.map((u) => [String(u._id), u.count]));
  const rows = restaurants
    .map((r) => {
      const last = lastMap.get(String(r._id));
      return {
        id: r._id, name: r.name, owner: r.ownerName, username: r.username, hue: r.hue, logoUrl: r.logoUrl,
        lastMessage: last ? (last.text || (last.imageUrl ? '📷 Photo' : '')) : '',
        lastMessageAt: last?.createdAt || null,
        lastSender: last?.sender || null,
        unreadCount: unreadMap.get(String(r._id)) || 0,
      };
    })
    .sort((a, b) => {
      if (!!b.unreadCount !== !!a.unreadCount) return (b.unreadCount ? 1 : 0) - (a.unreadCount ? 1 : 0);
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });
  res.json(rows);
});

router.get('/support/conversations/:id/messages', async (req, res) => {
  const r = await Restaurant.findById(req.params.id)
    .select('name ownerName username hue logoUrl supportEnabled city plan status subscriptionEndsAt graceEndsAt')
    .lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const messages = await SupportMessage.find({ restaurant: req.params.id }).sort({ createdAt: 1 }).limit(500).lean();
  // Opening a thread marks every store-sent message read — same "read on view" model used elsewhere.
  await SupportMessage.updateMany({ restaurant: req.params.id, sender: 'restaurant', readByAdmin: false }, { readByAdmin: true });
  res.json({
    restaurant: {
      id: r._id, name: r.name, owner: r.ownerName, username: r.username, hue: r.hue, logoUrl: r.logoUrl,
      supportEnabled: r.supportEnabled, city: r.city, plan: r.plan, status: r.status,
      subscriptionStatus: subscriptionStatus(r),
    },
    messages: messages.map(mapSupportMessage),
  });
});

router.post('/support/conversations/:id/messages', upload.single('image'), async (req, res) => {
  const r = await Restaurant.findById(req.params.id).select('name').lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  const text = String(req.body?.text || '').trim().slice(0, 2000);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  if (!text && !imageUrl) return res.status(400).json({ error: 'Message is empty' });
  const msg = await SupportMessage.create({ restaurant: req.params.id, sender: 'admin', senderName: adminName(req), text, imageUrl });
  const payload = mapSupportMessage(msg);
  emitToRestaurant(req.params.id, 'support:message', { restaurantId: String(req.params.id), message: payload });
  emitToAdmin('support:message', { restaurantId: String(req.params.id), restaurantName: r.name, message: payload });
  res.status(201).json(payload);
});

module.exports = router;
