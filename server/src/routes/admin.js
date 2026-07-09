const express = require('express');
const bcrypt = require('bcryptjs');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const { requireAdmin } = require('../middleware/auth');
const { makeTableCode, slugify } = require('../utils/codes');
const { emitToRestaurant, emitToAllRestaurants } = require('../socket');

const router = express.Router();
router.use(requireAdmin);

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
      id: r._id, name: r.name, city: r.city, owner: r.ownerName, plan: r.plan, status: r.status,
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

module.exports = router;
