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
const { requireAdmin } = require('../middleware/auth');
const { makeTableCode, slugify } = require('../utils/codes');
const { emitToRestaurant, emitToAllRestaurants } = require('../socket');
const { encrypt, decrypt } = require('../utils/crypto');

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

  const maxCount = Math.max(1, ...restaurants.map(r => countMap.get(String(r._id)) || 0));
  const chartRows = [...restaurants]
    .map(r => ({ name: r.name, orders: countMap.get(String(r._id)) || 0, hue: r.hue }))
    .sort((a, b) => b.orders - a.orders)
    .map(r => ({ name: r.name, ordStr: r.orders.toLocaleString(), barW: ((r.orders / maxCount) * 100).toFixed(0) + '%', fg: `hsl(${r.hue} 60% 52%)` }));

  const activity = await Activity.find().sort({ createdAt: -1 }).limit(6).lean();

  res.json({
    stats, chartRows,
    activity: activity.map(a => ({ t: a.message, d: timeAgo(a.createdAt), dot: a.dot })),
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
      hue: r.hue, orders: m.orders, revenue: '$' + m.revenue.toFixed(2),
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
  await Activity.create({ restaurant: restaurant._id, message: `${restaurant.name} joined · ${restaurant.plan} plan`, dot: '#12A150' });
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
    plan: r.plan, status: r.status, hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl,
    orders: orderCount, revenue: '$' + (revenueAgg[0]?.sum || 0).toFixed(2), createdAt: r.createdAt,
  });
});

router.patch('/restaurants/:id/toggle', async (req, res) => {
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = r.status === 'active' ? 'suspended' : 'active';
  await r.save();
  await Activity.create({
    restaurant: r._id,
    message: `${r.name} ${r.status === 'suspended' ? 'suspended' : 'activated'}`,
    dot: r.status === 'suspended' ? '#E5484D' : '#12A150',
  });
  res.json({ id: r._id, status: r.status });
});

router.patch('/restaurants/:id/password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const r = await Restaurant.findById(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.passwordHash = await bcrypt.hash(newPassword, 10);
  await r.save();
  await Activity.create({ restaurant: r._id, message: `${r.name} password was reset by admin`, dot: '#E8A317' });
  res.json({ ok: true });
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
  await Activity.create({ restaurant: restaurant._id, message: `${restaurant.name}: ${label || provider} connected`, dot: '#12A150' });
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
  res.json({ ok: true });
});

router.delete('/restaurants/:id/payment-accounts/:accountId', async (req, res) => {
  const account = await PaymentAccount.findOneAndDelete({ _id: req.params.accountId, restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
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
  await Activity.create({ restaurant: restaurant._id, message: `${restaurant.name}: SMS connected`, dot: '#12A150' });
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
  res.json({ ok: true });
});

router.delete('/restaurants/:id/sms-account', async (req, res) => {
  const account = await SmsAccount.findOneAndDelete({ restaurant: req.params.id });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
