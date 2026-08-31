const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Table = require('../models/Table');
const Order = require('../models/Order');
const PaymentAccount = require('../models/PaymentAccount');
const SmsAccount = require('../models/SmsAccount');
const SmsLog = require('../models/SmsLog');
const Staff = require('../models/Staff');
const { requireRestaurantOrStaff, requirePermission, requireAnyPermission, requireOwnerOnly } = require('../middleware/auth');
const { makeTableCode } = require('../utils/codes');
const { emitToRestaurant } = require('../socket');
const { chargeOrderPayment } = require('../utils/chargeOrder');
const { decrypt } = require('../utils/crypto');
const { sendSms } = require('../utils/hormuud');

const router = express.Router();
router.use(requireRestaurantOrStaff);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${req.auth.id}-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/me', async (req, res) => {
  const r = await Restaurant.findById(req.auth.id).lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  let staffName = null;
  if (req.auth.role === 'staff') {
    staffName = (await Staff.findById(req.auth.staffId).select('name').lean())?.name || null;
  }
  res.json({
    id: r._id, name: r.name, city: r.city, ownerName: r.ownerName, plan: r.plan,
    hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl,
    role: req.auth.role, permissions: req.auth.role === 'staff' ? req.auth.permissions : null, staffName,
  });
});

router.post('/upload', requireOwnerOnly, upload.single('image'), async (req, res) => {
  const { kind } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!['logo', 'cover'].includes(kind)) return res.status(400).json({ error: 'kind must be logo or cover' });
  const url = `/uploads/${req.file.filename}`;
  const field = kind === 'logo' ? 'logoUrl' : 'coverUrl';
  await Restaurant.findByIdAndUpdate(req.auth.id, { [field]: url });
  res.json({ url });
});

// ---- Categories ----
router.get('/categories', requireAnyPermission(['products', 'categories', 'pos']), async (req, res) => {
  const cats = await Category.find({ restaurant: req.auth.id }).sort({ order: 1, createdAt: 1 }).lean();
  res.json(cats.map(c => ({ id: c._id, en: c.nameEn, so: c.nameSo })));
});

router.post('/categories', requirePermission('categories'), async (req, res) => {
  const { nameEn, nameSo } = req.body || {};
  if (!nameEn || !nameSo) return res.status(400).json({ error: 'nameEn and nameSo are required' });
  const count = await Category.countDocuments({ restaurant: req.auth.id });
  const cat = await Category.create({ restaurant: req.auth.id, nameEn, nameSo, order: count });
  res.status(201).json({ id: cat._id, en: cat.nameEn, so: cat.nameSo });
});

router.patch('/categories/:id', requirePermission('categories'), async (req, res) => {
  const { nameEn, nameSo } = req.body || {};
  if (!nameEn || !nameSo) return res.status(400).json({ error: 'nameEn and nameSo are required' });
  const cat = await Category.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.auth.id },
    { nameEn, nameSo },
    { new: true },
  );
  if (!cat) return res.status(404).json({ error: 'Not found' });
  res.json({ id: cat._id, en: cat.nameEn, so: cat.nameSo });
});

router.delete('/categories/:id', requirePermission('categories'), async (req, res) => {
  const inUse = await Product.countDocuments({ restaurant: req.auth.id, category: req.params.id });
  if (inUse > 0) return res.status(409).json({ error: 'Category has products, move or delete them first' });
  const cat = await Category.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!cat) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Products ----
router.get('/products', requireAnyPermission(['overview', 'products', 'pos']), async (req, res) => {
  const products = await Product.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(products.map(mapProduct));
});

function mapProduct(p) {
  return {
    id: p._id, en: p.nameEn, so: p.nameSo, price: p.price, status: p.status,
    category: p.category, imageUrl: p.imageUrl, hue: p.hue, sold: p.sold,
  };
}

router.post('/products', requirePermission('products'), upload.single('image'), async (req, res) => {
  const { nameEn, nameSo, price, category } = req.body || {};
  if (!nameEn || !nameSo || price == null || !category) return res.status(400).json({ error: 'nameEn, nameSo, price, category are required' });
  const cat = await Category.findOne({ _id: category, restaurant: req.auth.id });
  if (!cat) return res.status(400).json({ error: 'Invalid category' });
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const p = await Product.create({ restaurant: req.auth.id, category, nameEn, nameSo, price: Number(price), imageUrl });
  res.status(201).json(mapProduct(p));
});

router.post('/products/:id/image', requirePermission('products'), upload.single('image'), async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  p.imageUrl = `/uploads/${req.file.filename}`;
  await p.save();
  res.json(mapProduct(p));
});

router.patch('/products/:id/toggle', requirePermission('products'), async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.status = p.status === 'active' ? 'inactive' : 'active';
  await p.save();
  res.json(mapProduct(p));
});

router.patch('/products/:id', requirePermission('products'), upload.single('image'), async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  const { nameEn, nameSo, price, category } = req.body || {};
  if (category) {
    const cat = await Category.findOne({ _id: category, restaurant: req.auth.id });
    if (!cat) return res.status(400).json({ error: 'Invalid category' });
    p.category = category;
  }
  if (nameEn) p.nameEn = nameEn;
  if (nameSo) p.nameSo = nameSo;
  if (price != null) p.price = Number(price);
  if (req.file) p.imageUrl = `/uploads/${req.file.filename}`;
  await p.save();
  res.json(mapProduct(p));
});

router.delete('/products/:id', requirePermission('products'), async (req, res) => {
  const p = await Product.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Tables ----
router.get('/tables', requirePermission('qr'), async (req, res) => {
  const tables = await Table.find({ restaurant: req.auth.id }).sort({ createdAt: 1 }).lean();
  res.json(tables.map(t => ({ id: t._id, label: t.label, type: t.type, code: t.code })));
});

router.post('/tables', requirePermission('qr'), async (req, res) => {
  const { label } = req.body || {};
  const clean = String(label || '').trim().toUpperCase();
  if (!clean) return res.status(400).json({ error: 'label required' });
  const existing = await Table.findOne({ restaurant: req.auth.id, type: 'table', label: clean });
  if (existing) return res.json({ id: existing._id, label: existing.label, type: existing.type, code: existing.code });
  const t = await Table.create({ restaurant: req.auth.id, label: clean, type: 'table', code: makeTableCode() });
  res.status(201).json({ id: t._id, label: t.label, type: t.type, code: t.code });
});

// ---- Orders ----
router.get('/orders', requireAnyPermission(['overview', 'orders']), async (req, res) => {
  const orders = await Order.find({
    restaurant: req.auth.id,
    $or: [{ 'payment.method': 'pay_at_table' }, { 'payment.status': 'paid' }],
  }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(orders.map(mapOrder));
});

function mapOrder(o) {
  return {
    id: o._id, number: o.number, channel: o.channel, tableLabel: o.tableLabel, phone: o.phone, note: o.note,
    items: o.items, total: o.total, discount: o.discount || 0, status: o.status, payment: o.payment, createdAt: o.createdAt,
  };
}

router.post('/orders/:id/accept', requirePermission('orders'), async (req, res) => {
  const o = await Order.findOneAndUpdate({ _id: req.params.id, restaurant: req.auth.id }, { status: 'preparing' }, { new: true });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(mapOrder(o));
});

router.post('/orders/:id/complete', requirePermission('orders'), async (req, res) => {
  const o = await Order.findOneAndUpdate({ _id: req.params.id, restaurant: req.auth.id }, { status: 'done' }, { new: true });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(mapOrder(o));
});

router.delete('/orders/:id', requireAnyPermission(['orders', 'payments']), async (req, res) => {
  const o = await Order.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/payments', requirePermission('payments'), async (req, res) => {
  const orders = await Order.find({ restaurant: req.auth.id, 'payment.method': 'waafipay' })
    .sort({ createdAt: -1 }).limit(300).lean();
  res.json(orders.map(o => ({
    id: o._id, number: o.number, phone: o.phone, total: o.total, createdAt: o.createdAt, updatedAt: o.updatedAt,
    payment: o.payment,
  })));
});

router.post('/orders/simulate', requirePermission('orders'), async (req, res) => {
  const restaurant = await Restaurant.findById(req.auth.id);
  const products = await Product.find({ restaurant: req.auth.id, status: 'active' }).lean();
  const tables = await Table.find({ restaurant: req.auth.id }).lean();
  if (!products.length) return res.status(400).json({ error: 'Add products first' });

  const pickCount = 1 + Math.floor(Math.random() * 2);
  const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, pickCount);
  const items = shuffled.map(p => ({ name: p.nameEn, qty: 1 + Math.floor(Math.random() * 2), price: p.price }));
  const total = items.reduce((a, i) => a + i.price * i.qty, 0);

  const realTables = tables.filter(t => t.type === 'table');
  const channels = ['table', 'table', 'takeaway', 'online'];
  const channel = realTables.length ? channels[Math.floor(Math.random() * channels.length)] : (Math.random() < 0.5 ? 'takeaway' : 'online');
  const tableLabel = channel === 'table' && realTables.length ? realTables[Math.floor(Math.random() * realTables.length)].label : null;
  const phone = '06' + Math.floor(10000000 + Math.random() * 89999999);

  const number = restaurant.nextOrderNumber();
  await restaurant.save();
  const order = await Order.create({ restaurant: req.auth.id, number, channel, tableLabel, phone, items, total, status: 'new' });
  await Product.updateMany(
    { _id: { $in: shuffled.map(p => p._id) } },
    [{ $set: { sold: { $add: ['$sold', 1] } } }]
  );

  const payload = mapOrder(order.toObject());
  emitToRestaurant(req.auth.id, 'order:new', payload);
  res.status(201).json(payload);
});

// ---- POS (staff-taken orders) ----
router.get('/pos/payment-options', requirePermission('pos'), async (req, res) => {
  const accounts = await PaymentAccount.find({ restaurant: req.auth.id, status: 'active' }).lean();
  res.json({
    paymentOptions: accounts.map(a => ({ provider: a.provider, label: a.label || a.provider })),
    defaultProvider: (accounts.find(a => a.isPrimary) || accounts[0])?.provider || null,
  });
});

router.post('/pos/orders', requirePermission('pos'), async (req, res) => {
  const { phone, note, items, paymentProvider, payNow, clientRequestId, discount } = req.body || {};
  const cleanPhone = String(phone || '').trim();
  const cleanNote = String(note || '').trim();
  if (!cleanPhone) return res.status(400).json({ error: 'Phone number is required' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });

  const restaurant = await Restaurant.findById(req.auth.id);
  const productIds = items.map(i => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, restaurant: req.auth.id, status: 'active' }).lean();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  const orderItems = [];
  for (const i of items) {
    const p = productMap.get(String(i.productId));
    const qty = Math.max(1, Number(i.qty) || 1);
    if (!p) continue;
    orderItems.push({ name: p.nameEn, qty, price: p.price });
  }
  if (!orderItems.length) return res.status(400).json({ error: 'No valid items in cart' });

  const subtotal = orderItems.reduce((a, i) => a + i.price * i.qty, 0);
  const discountAmount = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = Math.round((subtotal - discountAmount) * 100) / 100;

  async function bumpSold() {
    await Product.bulkWrite(items.map(i => ({
      updateOne: { filter: { _id: i.productId }, update: { $inc: { sold: Math.max(1, Number(i.qty) || 1) } } },
    })));
  }

  // Manual order: staff collects payment at the till, no online charge.
  if (!payNow) {
    const number = restaurant.nextOrderNumber();
    await restaurant.save();
    const order = await Order.create({
      restaurant: req.auth.id, number, channel: 'pos',
      phone: cleanPhone, note: cleanNote, items: orderItems, total, discount: discountAmount, status: 'new',
    });
    await bumpSold();
    const payload = mapOrder(order.toObject());
    emitToRestaurant(req.auth.id, 'order:new', payload);
    return res.status(201).json(payload);
  }

  const paymentAccounts = await PaymentAccount.find({ restaurant: req.auth.id, status: 'active' }).lean();
  let account;
  if (paymentProvider) {
    account = paymentAccounts.find(a => a.provider === paymentProvider);
    if (!account) return res.status(400).json({ error: 'Selected payment provider is not available' });
  } else if (paymentAccounts.length === 1) {
    account = paymentAccounts[0];
  } else {
    return res.status(400).json({ error: paymentAccounts.length ? 'paymentProvider is required' : 'No payment provider connected' });
  }

  let order = null;
  if (clientRequestId) {
    order = await Order.findOne({ restaurant: req.auth.id, 'payment.clientRequestId': clientRequestId });
  }
  if (order && order.payment?.status === 'paid') {
    return res.status(201).json(mapOrder(order.toObject()));
  }
  if (!order) {
    const number = restaurant.nextOrderNumber();
    await restaurant.save();
    order = await Order.create({
      restaurant: req.auth.id, number, channel: 'pos',
      phone: cleanPhone, note: cleanNote, items: orderItems, total, discount: discountAmount, status: 'new',
      payment: {
        method: 'waafipay', provider: account.provider, status: 'pending',
        amount: total, currency: account.currency, clientRequestId: clientRequestId || null,
      },
    });
    await bumpSold();
  }

  const result = await chargeOrderPayment(order, account, { phone: cleanPhone });
  if (result.outcome === 'paid') {
    const payload = mapOrder(order.toObject());
    emitToRestaurant(req.auth.id, 'order:new', payload);
    return res.status(201).json(payload);
  }
  return res.status(402).json(result.body);
});

router.post('/pos/orders/:id/pay-at-table', requirePermission('pos'), async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.payment?.status === 'paid') return res.status(400).json({ error: 'Already paid' });
  order.payment.method = 'pay_at_table';
  order.payment.status = 'none';
  await order.save();
  const payload = mapOrder(order.toObject());
  emitToRestaurant(req.auth.id, 'order:new', payload);
  res.json(payload);
});

// ---- Sales ----
router.get('/sales', requirePermission('overview'), async (req, res) => {
  const { category } = req.query;
  const filter = { restaurant: req.auth.id };
  if (category && category !== 'all') filter.category = category;
  const products = await Product.find(filter).populate('category').lean();
  const rows = products.map(p => ({
    id: p._id, en: p.nameEn, so: p.nameSo, price: p.price, sold: p.sold, revenue: p.price * p.sold,
    catEn: p.category?.nameEn || '', catSo: p.category?.nameSo || '',
  }));
  const totRev = rows.reduce((a, r) => a + r.revenue, 0);
  const totSold = rows.reduce((a, r) => a + r.sold, 0);
  res.json({ rows, totRev, totSold });
});

// ---- SMS (Hormuud) ----
router.get('/sms/status', requirePermission('sms'), async (req, res) => {
  const account = await SmsAccount.findOne({ restaurant: req.auth.id }).lean();
  if (!account) return res.json({ connected: false });
  res.json({ connected: true, senderId: account.senderId, status: account.status });
});

router.get('/sms/recipients', requirePermission('sms'), async (req, res) => {
  const rows = await Order.aggregate([
    { $match: { restaurant: new mongoose.Types.ObjectId(req.auth.id) } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$phone', orders: { $sum: 1 }, lastOrderNumber: { $first: '$number' }, lastOrderAt: { $first: '$createdAt' } } },
    { $sort: { lastOrderAt: -1 } },
    { $limit: 500 },
  ]);
  res.json(rows.map(r => ({ phone: r._id, orders: r.orders, lastOrderNumber: r.lastOrderNumber, lastOrderAt: r.lastOrderAt })));
});

router.post('/sms/send', requirePermission('sms'), async (req, res) => {
  const { mode, phones, message } = req.body || {};
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return res.status(400).json({ error: 'Message is required' });
  if (cleanMessage.length > 1000) return res.status(400).json({ error: 'Message is too long' });

  const account = await SmsAccount.findOne({ restaurant: req.auth.id, status: 'active' });
  if (!account) return res.status(400).json({ error: 'SMS is not connected for this restaurant · Fadlan la xiriir maamulaha' });

  let recipients;
  if (mode === 'all') {
    recipients = await Order.distinct('phone', { restaurant: req.auth.id });
  } else {
    if (!Array.isArray(phones) || !phones.length) return res.status(400).json({ error: 'Select at least one recipient' });
    recipients = phones;
  }
  const uniquePhones = [...new Set(recipients.map(p => String(p || '').trim()).filter(Boolean))];
  if (!uniquePhones.length) return res.status(400).json({ error: 'No valid recipients' });

  const username = decrypt(account.username);
  const password = decrypt(account.password);

  let sent = 0;
  let failed = 0;
  const results = [];
  for (const phone of uniquePhones) {
    const result = await sendSms({ username, password, mobile: phone, message: cleanMessage, senderid: account.senderId });
    if (result.ok) sent += 1; else failed += 1;
    const errorText = result.ok ? null : `${result.description.so} · ${result.description.en}`;
    await SmsLog.create({
      restaurant: req.auth.id, phone, message: cleanMessage,
      status: result.ok ? 'sent' : 'failed',
      providerMessageId: result.messageId || null,
      error: errorText,
    });
    results.push({ phone, ok: result.ok, error: errorText });
  }
  res.json({ total: uniquePhones.length, sent, failed, results });
});

router.get('/sms/logs', requirePermission('sms'), async (req, res) => {
  const logs = await SmsLog.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(logs.map(l => ({
    id: l._id, phone: l.phone, message: l.message, status: l.status,
    error: l.error, createdAt: l.createdAt,
  })));
});

router.delete('/sms/logs/:id', requirePermission('sms'), async (req, res) => {
  const log = await SmsLog.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!log) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Staff accounts (owner only) ----
function mapStaff(s) {
  return {
    id: s._id, name: s.name, username: s.username, role: s.role,
    permissions: s.permissions, status: s.status, createdAt: s.createdAt,
  };
}

router.get('/staff', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(staff.map(mapStaff));
});

router.post('/staff', requireOwnerOnly, async (req, res) => {
  const { name, username, password, role, permissions } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const cleanUsername = String(username).trim().toLowerCase();
  const existing = await Staff.findOne({ username: cleanUsername });
  if (existing) return res.status(409).json({ error: 'Username already taken' });
  const cleanPermissions = Array.isArray(permissions) ? permissions.filter((p) => Staff.PAGE_IDS.includes(p)) : [];
  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await Staff.create({
    restaurant: req.auth.id, name, username: cleanUsername, passwordHash,
    role: role || 'Staff', permissions: cleanPermissions,
  });
  res.status(201).json(mapStaff(staff));
});

router.patch('/staff/:id', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!staff) return res.status(404).json({ error: 'Not found' });
  const { name, username, password, role, permissions } = req.body || {};
  if (username && username.trim().toLowerCase() !== staff.username) {
    const cleanUsername = String(username).trim().toLowerCase();
    const existing = await Staff.findOne({ username: cleanUsername, _id: { $ne: staff._id } });
    if (existing) return res.status(409).json({ error: 'Username already taken' });
    staff.username = cleanUsername;
  }
  if (name) staff.name = name;
  if (role != null) staff.role = role;
  if (Array.isArray(permissions)) staff.permissions = permissions.filter((p) => Staff.PAGE_IDS.includes(p));
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    staff.passwordHash = await bcrypt.hash(password, 10);
  }
  await staff.save();
  res.json(mapStaff(staff));
});

router.patch('/staff/:id/toggle', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!staff) return res.status(404).json({ error: 'Not found' });
  staff.status = staff.status === 'active' ? 'suspended' : 'active';
  await staff.save();
  res.json(mapStaff(staff));
});

router.delete('/staff/:id', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!staff) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
