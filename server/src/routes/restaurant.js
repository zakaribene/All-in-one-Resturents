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
const PaymentMethod = require('../models/PaymentMethod');
const PaymentCollection = require('../models/PaymentCollection');
const PaymentTransfer = require('../models/PaymentTransfer');
const ExpenseCategory = require('../models/ExpenseCategory');
const Expense = require('../models/Expense');
const SmsAccount = require('../models/SmsAccount');
const SmsLog = require('../models/SmsLog');
const Staff = require('../models/Staff');
const { requireRestaurantOrStaff, requirePermission, requireAnyPermission, requireOwnerOnly } = require('../middleware/auth');
const { makeTableCode } = require('../utils/codes');
const { emitToRestaurant } = require('../socket');
const { chargeOrderPayment } = require('../utils/chargeOrder');
const { decrypt } = require('../utils/crypto');
const { sendSms } = require('../utils/hormuud');
const tabaarak = require('../utils/tabaarak');
const { buildXlsx, buildPdf, fmtMoney } = require('../utils/reportExport');

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
  let hasPosPin = false;
  if (req.auth.role === 'staff') {
    const staff = await Staff.findById(req.auth.staffId).select('name posPinHash').lean();
    staffName = staff?.name || null;
    hasPosPin = !!staff?.posPinHash;
  }
  const posPinRequired = req.auth.role === 'staff' && Array.isArray(req.auth.permissions) && req.auth.permissions.includes('pos');
  res.json({
    id: r._id, name: r.name, city: r.city, ownerName: r.ownerName, plan: r.plan,
    hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl,
    role: req.auth.role, permissions: req.auth.role === 'staff' ? req.auth.permissions : null, staffName,
    posPinRequired, hasPosPin,
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

// Name shown as the collector on a manual payment ledger row.
async function resolveCollector(req) {
  if (req.auth.role === 'restaurant') return { id: null, name: 'Owner' };
  const s = await Staff.findById(req.auth.staffId).select('name').lean();
  return { id: req.auth.staffId, name: s?.name || 'Staff' };
}

// Attributes an order's total to a restaurant-defined manual payment method:
// stamps the order, bumps the method's running balance, and writes a ledger row.
async function attributeManualCollection(order, method, collector) {
  order.payment.method = 'pay_at_table';
  order.payment.manualMethod = method._id;
  order.payment.manualMethodName = method.name;
  order.payment.collectedByName = collector.name;
  await order.save();
  await PaymentMethod.updateOne({ _id: method._id }, { $inc: { balance: order.total } });
  await PaymentCollection.create({
    restaurant: order.restaurant, method: method._id, methodName: method.name,
    order: order._id, orderNumber: order.number, amount: order.total,
    staff: collector.id, staffName: collector.name,
  });
}

router.get('/pos/payment-options', requirePermission('pos'), async (req, res) => {
  const [accounts, methods] = await Promise.all([
    PaymentAccount.find({ restaurant: req.auth.id, status: 'active' }).lean(),
    PaymentMethod.find({ restaurant: req.auth.id, status: 'active' }).sort({ createdAt: 1 }).lean(),
  ]);
  res.json({
    paymentOptions: accounts.map(a => ({ provider: a.provider, label: a.label || a.provider })),
    defaultProvider: (accounts.find(a => a.isPrimary) || accounts[0])?.provider || null,
    manualMethods: methods.map(m => ({ id: m._id, name: m.name })),
  });
});

router.post('/pos/unlock', requirePermission('pos'), async (req, res) => {
  if (req.auth.role === 'restaurant') return res.json({ ok: true });
  const pin = String(req.body?.pin || '');
  const staff = await Staff.findById(req.auth.staffId).select('posPinHash').lean();
  if (!staff?.posPinHash) return res.status(400).json({ error: 'PIN weli laguuma dejin · Ask the owner to set your POS PIN' });
  const ok = await bcrypt.compare(pin, staff.posPinHash);
  if (!ok) return res.status(401).json({ error: 'PIN qaldan · Wrong PIN' });
  res.json({ ok: true });
});

router.post('/pos/orders', requirePermission('pos'), async (req, res) => {
  const { phone, note, items, paymentProvider, payNow, clientRequestId, discount, manualMethodId } = req.body || {};
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
    const activeMethods = await PaymentMethod.find({ restaurant: req.auth.id, status: 'active' }).lean();
    let method = null;
    if (activeMethods.length) {
      method = activeMethods.find(m => String(m._id) === String(manualMethodId));
      if (!method) return res.status(400).json({ error: 'Dooro habka lacag-bixinta · Choose a payment method' });
    }
    const number = restaurant.nextOrderNumber();
    await restaurant.save();
    const order = await Order.create({
      restaurant: req.auth.id, number, channel: 'pos',
      phone: cleanPhone, note: cleanNote, items: orderItems, total, discount: discountAmount, status: 'new',
    });
    await bumpSold();
    if (method) await attributeManualCollection(order, method, await resolveCollector(req));
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
  const { manualMethodId } = req.body || {};
  const order = await Order.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.payment?.status === 'paid') return res.status(400).json({ error: 'Already paid' });
  order.payment.method = 'pay_at_table';
  order.payment.status = 'none';
  order.payment.provider = null;
  await order.save();
  if (manualMethodId && !order.payment.manualMethod && mongoose.Types.ObjectId.isValid(manualMethodId)) {
    const method = await PaymentMethod.findOne({ _id: manualMethodId, restaurant: req.auth.id, status: 'active' });
    if (method) await attributeManualCollection(order, method, await resolveCollector(req));
  }
  const payload = mapOrder(order.toObject());
  emitToRestaurant(req.auth.id, 'order:new', payload);
  res.json(payload);
});

// ---- Payment methods (manual wallets + running balances) ----
function mapMethod(m, agg) {
  return {
    id: m._id, name: m.name, status: m.status,
    balance: Math.round((m.balance || 0) * 100) / 100,
    todayTotal: Math.round((agg?.total || 0) * 100) / 100,
    count: agg?.count || 0,
  };
}

router.get('/payment-methods', requireAnyPermission(['paymethods', 'overview']), async (req, res) => {
  const methods = await PaymentMethod.find({ restaurant: req.auth.id }).sort({ createdAt: 1 }).lean();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await PaymentCollection.aggregate([
    { $match: { restaurant: new mongoose.Types.ObjectId(req.auth.id), createdAt: { $gte: start } } },
    { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const byId = new Map(rows.map(r => [String(r._id), r]));
  res.json(methods.map(m => mapMethod(m, byId.get(String(m._id)))));
});

router.get('/payment-methods/collections', requirePermission('paymethods'), async (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
  const rows = await PaymentCollection.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json(rows.map(r => ({
    id: r._id, amount: r.amount, orderNumber: r.orderNumber,
    methodName: r.methodName, staffName: r.staffName, createdAt: r.createdAt,
  })));
});

router.post('/payment-methods', requirePermission('paymethods'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required · Magaca waa lagama maarmaan' });
  const existing = await PaymentMethod.findOne({ restaurant: req.auth.id, name });
  if (existing) return res.status(409).json({ error: 'A method with this name already exists · Magacan hore ayaa loo isticmaalay' });
  const m = await PaymentMethod.create({ restaurant: req.auth.id, name });
  res.status(201).json(mapMethod(m, null));
});

router.patch('/payment-methods/:id', requirePermission('paymethods'), async (req, res) => {
  const m = await PaymentMethod.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { name, status } = req.body || {};
  if (name != null) {
    const clean = String(name).trim();
    if (!clean) return res.status(400).json({ error: 'Name is required · Magaca waa lagama maarmaan' });
    const dup = await PaymentMethod.findOne({ restaurant: req.auth.id, name: clean, _id: { $ne: m._id } });
    if (dup) return res.status(409).json({ error: 'A method with this name already exists · Magacan hore ayaa loo isticmaalay' });
    m.name = clean;
  }
  if (status && ['active', 'disabled'].includes(status)) m.status = status;
  await m.save();
  res.json(mapMethod(m, null));
});

router.delete('/payment-methods/:id', requirePermission('paymethods'), async (req, res) => {
  const m = await PaymentMethod.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Payment transfers (move a balance from one wallet to another) ----
function mapTransfer(t) {
  return {
    id: t._id,
    fromMethodName: t.fromMethodName,
    toMethodName: t.toMethodName,
    amount: Math.round((t.amount || 0) * 100) / 100,
    note: t.note || '',
    staffName: t.staffName || '',
    createdAt: t.createdAt,
  };
}

router.get('/payment-transfers', requirePermission('transfers'), async (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
  const [methods, rows] = await Promise.all([
    PaymentMethod.find({ restaurant: req.auth.id }).sort({ createdAt: 1 }).lean(),
    PaymentTransfer.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  res.json({
    methods: methods.map(m => ({
      id: m._id, name: m.name, status: m.status,
      balance: Math.round((m.balance || 0) * 100) / 100,
    })),
    transfers: rows.map(mapTransfer),
  });
});

router.post('/payment-transfers', requirePermission('transfers'), async (req, res) => {
  const { fromMethodId, toMethodId, note } = req.body || {};
  const amount = Math.round((Number(req.body?.amount) || 0) * 100) / 100;

  if (!mongoose.Types.ObjectId.isValid(fromMethodId) || !mongoose.Types.ObjectId.isValid(toMethodId)) {
    return res.status(400).json({ error: 'Dooro labada hab · Choose both wallets' });
  }
  if (String(fromMethodId) === String(toMethodId)) {
    return res.status(400).json({ error: 'Isku hab lama wareejin karo · Pick two different wallets' });
  }
  if (!(amount > 0)) {
    return res.status(400).json({ error: 'Qadarka waa inuu ka weyn yahay 0 · Amount must be greater than 0' });
  }

  const [from, to] = await Promise.all([
    PaymentMethod.findOne({ _id: fromMethodId, restaurant: req.auth.id }),
    PaymentMethod.findOne({ _id: toMethodId, restaurant: req.auth.id }),
  ]);
  if (!from || !to) return res.status(404).json({ error: 'Hab lama helin · Wallet not found' });
  if (from.status !== 'active' || to.status !== 'active') {
    return res.status(400).json({ error: 'Habka waa inuu firfircoon yahay · Both wallets must be active' });
  }

  // Debit atomically so two transfers can't overdraw the same wallet.
  const debited = await PaymentMethod.findOneAndUpdate(
    { _id: from._id, restaurant: req.auth.id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
  if (!debited) {
    return res.status(400).json({ error: `Balance ku filan ma jiro ${from.name} · Not enough balance in ${from.name}` });
  }
  const credited = await PaymentMethod.findOneAndUpdate(
    { _id: to._id, restaurant: req.auth.id },
    { $inc: { balance: amount } },
    { new: true },
  );

  const collector = await resolveCollector(req);
  const transfer = await PaymentTransfer.create({
    restaurant: req.auth.id,
    fromMethod: from._id, fromMethodName: from.name,
    toMethod: to._id, toMethodName: to.name,
    amount, note: String(note || '').trim().slice(0, 200),
    staff: collector.id, staffName: collector.name,
  });

  res.status(201).json({
    transfer: mapTransfer(transfer),
    balances: {
      [String(from._id)]: Math.round((debited.balance || 0) * 100) / 100,
      [String(to._id)]: Math.round((credited?.balance || 0) * 100) / 100,
    },
  });
});

// ---- Expenses (money out, paid from a wallet) ----
router.get('/expense-categories', requirePermission('expenses'), async (req, res) => {
  const cats = await ExpenseCategory.find({ restaurant: req.auth.id }).sort({ name: 1 }).lean();
  res.json(cats.map(c => ({ id: c._id, name: c.name })));
});

router.post('/expense-categories', requirePermission('expenses'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required · Magaca waa lagama maarmaan' });
  const existing = await ExpenseCategory.findOne({ restaurant: req.auth.id, name });
  if (existing) return res.status(409).json({ error: 'A category with this name already exists · Magacan hore ayaa loo isticmaalay' });
  const c = await ExpenseCategory.create({ restaurant: req.auth.id, name });
  res.status(201).json({ id: c._id, name: c.name });
});

router.delete('/expense-categories/:id', requirePermission('expenses'), async (req, res) => {
  const inUse = await Expense.countDocuments({ restaurant: req.auth.id, category: req.params.id });
  if (inUse > 0) return res.status(409).json({ error: 'Category is used by expenses · Qaybtan kharashaad ayaa ku xiran' });
  const c = await ExpenseCategory.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

function mapExpense(e) {
  return {
    id: e._id,
    categoryName: e.categoryName,
    methodName: e.methodName,
    amount: Math.round((e.amount || 0) * 100) / 100,
    note: e.note || '',
    staffName: e.staffName || '',
    createdAt: e.createdAt,
  };
}

router.get('/expenses', requirePermission('expenses'), async (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
  const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
  const [methods, categories, rows, agg] = await Promise.all([
    PaymentMethod.find({ restaurant: req.auth.id }).sort({ createdAt: 1 }).lean(),
    ExpenseCategory.find({ restaurant: req.auth.id }).sort({ name: 1 }).lean(),
    Expense.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).limit(limit).lean(),
    Expense.aggregate([
      { $match: { restaurant: new mongoose.Types.ObjectId(req.auth.id) } },
      { $group: {
        _id: null,
        today: { $sum: { $cond: [{ $gte: ['$createdAt', startDay] }, '$amount', 0] } },
        month: { $sum: { $cond: [{ $gte: ['$createdAt', startMonth] }, '$amount', 0] } },
      } },
    ]),
  ]);
  res.json({
    methods: methods.map(m => ({
      id: m._id, name: m.name, status: m.status,
      balance: Math.round((m.balance || 0) * 100) / 100,
    })),
    categories: categories.map(c => ({ id: c._id, name: c.name })),
    expenses: rows.map(mapExpense),
    totals: {
      today: Math.round((agg[0]?.today || 0) * 100) / 100,
      month: Math.round((agg[0]?.month || 0) * 100) / 100,
    },
  });
});

router.post('/expenses', requirePermission('expenses'), async (req, res) => {
  const { categoryId, methodId, note } = req.body || {};
  const amount = Math.round((Number(req.body?.amount) || 0) * 100) / 100;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) return res.status(400).json({ error: 'Dooro qaybta · Choose a category' });
  if (!mongoose.Types.ObjectId.isValid(methodId)) return res.status(400).json({ error: 'Dooro habka lacag-bixinta · Choose a payment method' });
  if (!(amount > 0)) return res.status(400).json({ error: 'Qadarka waa inuu ka weyn yahay 0 · Amount must be greater than 0' });

  const [cat, method] = await Promise.all([
    ExpenseCategory.findOne({ _id: categoryId, restaurant: req.auth.id }),
    PaymentMethod.findOne({ _id: methodId, restaurant: req.auth.id }),
  ]);
  if (!cat) return res.status(404).json({ error: 'Qayb lama helin · Category not found' });
  if (!method) return res.status(404).json({ error: 'Hab lama helin · Wallet not found' });
  if (method.status !== 'active') return res.status(400).json({ error: 'Habka waa inuu firfircoon yahay · Wallet must be active' });

  // Debit atomically so concurrent expenses can't overdraw the same wallet.
  const debited = await PaymentMethod.findOneAndUpdate(
    { _id: method._id, restaurant: req.auth.id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
  if (!debited) {
    return res.status(400).json({ error: `Balance ku filan ma jiro ${method.name} · Not enough balance in ${method.name}` });
  }

  const collector = await resolveCollector(req);
  const expense = await Expense.create({
    restaurant: req.auth.id,
    category: cat._id, categoryName: cat.name,
    method: method._id, methodName: method.name,
    amount, note: String(note || '').trim().slice(0, 200),
    staff: collector.id, staffName: collector.name,
  });
  res.status(201).json({
    expense: mapExpense(expense),
    balance: { [String(method._id)]: Math.round((debited.balance || 0) * 100) / 100 },
  });
});

router.delete('/expenses/:id', requirePermission('expenses'), async (req, res) => {
  const e = await Expense.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!e) return res.status(404).json({ error: 'Not found' });
  let balance = null;
  if (e.method) {
    const credited = await PaymentMethod.findOneAndUpdate(
      { _id: e.method, restaurant: req.auth.id },
      { $inc: { balance: e.amount } },
      { new: true },
    );
    if (credited) balance = { [String(e.method)]: Math.round((credited.balance || 0) * 100) / 100 };
  }
  res.json({ ok: true, balance });
});

// ---- Reports (Sales + Expense, filterable, Excel / PDF export) ----
const CHANNEL_LABEL = { table: 'Table', takeaway: 'Takeaway', online: 'Online', pos: 'POS' };

function reportRange(q) {
  const from = String(q.from || '').slice(0, 10);
  const to = String(q.to || '').slice(0, 10);
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) range.$gte = new Date(from + 'T00:00:00.000Z');
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) range.$lte = new Date(to + 'T23:59:59.999Z');
  return { from, to, range: (range.$gte || range.$lte) ? range : null };
}

async function reportBrand(id) {
  const r = await Restaurant.findById(id).select('name city plan hue logoUrl').lean();
  return r || { name: 'Restaurant', hue: 212 };
}

function reportFilename(spec, ext) {
  const safe = String(spec.restaurant.name || 'restaurant').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'restaurant';
  const kind = spec.reportName.toLowerCase().split(' ')[0];
  return `${safe}_${kind}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

const SALES_COLUMNS = [
  { header: 'Order', headerSo: 'Dalab', key: 'number', w: 1, width: 11, format: 'int' },
  { header: 'Date / Time', headerSo: 'Taariikh', key: 'createdAt', w: 1.9, width: 19, format: 'datetime' },
  { header: 'Channel', headerSo: 'Kanaal', key: 'channel', w: 1.2, width: 13 },
  { header: 'Table', headerSo: 'Miis', key: 'tableLabel', w: 0.9, width: 9 },
  { header: 'Phone', headerSo: 'Taleefan', key: 'phone', w: 1.5, width: 16 },
  { header: 'Items', headerSo: 'Alaab', key: 'itemsCount', w: 0.8, width: 8, align: 'right', format: 'int' },
  { header: 'Discount', headerSo: 'Dhimis', key: 'discount', w: 1.1, width: 12, align: 'right', format: 'money' },
  { header: 'Total', headerSo: 'Wadar', key: 'total', w: 1.2, width: 13, align: 'right', format: 'money' },
  { header: 'Payment', headerSo: 'Lacag-bixin', key: 'payMethod', w: 1.7, width: 18 },
  { header: 'Collected by', headerSo: 'Qofka', key: 'collectedBy', w: 1.4, width: 16 },
  { header: 'Status', headerSo: 'Xaalad', key: 'status', w: 1, width: 11 },
];

async function buildSalesSpec(req) {
  const q = req.query || {};
  const { from, to, range } = reportRange(q);
  const filter = { restaurant: req.auth.id };
  if (range) filter.createdAt = range;
  if (q.orderId && /^\d+$/.test(String(q.orderId).trim())) filter.number = Number(String(q.orderId).trim());
  if (q.channel && q.channel !== 'all') filter.channel = q.channel;
  if (q.status && q.status !== 'all') filter.status = q.status;
  if (q.method && q.method !== 'all') {
    if (q.method === 'online') filter['payment.method'] = 'waafipay';
    else filter['payment.manualMethodName'] = q.method;
  }

  const orders = await Order.find(filter).sort({ createdAt: 1 }).limit(5000).lean();
  const rows = orders.map((o) => {
    const itemsCount = (o.items || []).reduce((a, it) => a + (it.qty || 0), 0);
    let payMethod = o.payment?.manualMethodName || '';
    if (!payMethod && o.payment?.method === 'waafipay') {
      payMethod = 'Online' + (o.payment.provider ? ' · ' + String(o.payment.provider).toUpperCase() : '');
    }
    return {
      number: o.number,
      createdAt: o.createdAt,
      channel: CHANNEL_LABEL[o.channel] || o.channel,
      tableLabel: o.tableLabel || '',
      phone: o.phone || '',
      itemsCount,
      discount: o.discount || 0,
      total: o.total || 0,
      payMethod: payMethod || '—',
      collectedBy: o.payment?.collectedByName || '',
      status: o.status,
    };
  });

  const sumTotal = rows.reduce((a, r) => a + r.total, 0);
  const sumDiscount = rows.reduce((a, r) => a + r.discount, 0);
  const sumItems = rows.reduce((a, r) => a + r.itemsCount, 0);

  const filterLines = [
    `Range: ${from || '—'}  ->  ${to || '—'}`,
    q.orderId ? `Order #${q.orderId}` : null,
    q.channel && q.channel !== 'all' ? `Channel: ${CHANNEL_LABEL[q.channel] || q.channel}` : null,
    q.status && q.status !== 'all' ? `Status: ${q.status}` : null,
    q.method && q.method !== 'all' ? `Payment: ${q.method === 'online' ? 'Online' : q.method}` : null,
  ].filter(Boolean);

  return {
    restaurant: await reportBrand(req.auth.id),
    reportName: 'Sales Report', reportNameSo: 'Warbixinta Iibka',
    filterLines,
    summary: [
      { label: 'Orders · Dalabyo', value: String(rows.length) },
      { label: 'Total · Wadar', value: fmtMoney(sumTotal) },
      { label: 'Discounts · Dhimis', value: fmtMoney(sumDiscount) },
      { label: 'Items · Alaab', value: String(sumItems) },
      { label: 'Avg order · Celceli', value: fmtMoney(rows.length ? sumTotal / rows.length : 0) },
    ],
    columns: SALES_COLUMNS,
    rows,
    totalsRow: { label: 'TOTAL', values: { discount: sumDiscount, total: sumTotal, itemsCount: sumItems } },
  };
}

const EXPENSE_COLUMNS = [
  { header: 'Date', headerSo: 'Taariikh', key: 'createdAt', w: 1.4, width: 14, format: 'date' },
  { header: 'Category', headerSo: 'Qayb', key: 'categoryName', w: 1.9, width: 22 },
  { header: 'Payment method', headerSo: 'Hab', key: 'methodName', w: 1.7, width: 20 },
  { header: 'Amount', headerSo: 'Qadar', key: 'amount', w: 1.2, width: 14, align: 'right', format: 'money' },
  { header: 'Note', headerSo: 'Faallo', key: 'note', w: 3, width: 34, wrap: true },
  { header: 'Recorded by', headerSo: 'Qofka', key: 'staffName', w: 1.5, width: 18 },
];

async function buildExpensesSpec(req) {
  const q = req.query || {};
  const { from, to, range } = reportRange(q);
  const filter = { restaurant: req.auth.id };
  if (range) filter.createdAt = range;
  if (q.category && q.category !== 'all') {
    if (mongoose.Types.ObjectId.isValid(q.category)) filter.category = q.category;
    else filter.categoryName = String(q.category);
  }
  if (q.method && q.method !== 'all') {
    if (mongoose.Types.ObjectId.isValid(q.method)) filter.method = q.method;
    else filter.methodName = String(q.method);
  }

  const list = await Expense.find(filter).sort({ createdAt: 1 }).limit(5000).lean();
  const rows = list.map((e) => ({
    createdAt: e.createdAt,
    categoryName: e.categoryName || '',
    methodName: e.methodName || '',
    amount: e.amount || 0,
    note: e.note || '',
    staffName: e.staffName || '',
  }));
  const sum = rows.reduce((a, r) => a + r.amount, 0);

  let catLabel = filter.categoryName || null;
  let methodLabel = filter.methodName || null;
  if (filter.category) { const c = await ExpenseCategory.findById(filter.category).lean(); catLabel = c?.name; }
  if (filter.method) { const m = await PaymentMethod.findById(filter.method).lean(); methodLabel = m?.name; }

  const filterLines = [
    `Range: ${from || '—'}  ->  ${to || '—'}`,
    catLabel ? `Category: ${catLabel}` : null,
    methodLabel ? `Method: ${methodLabel}` : null,
  ].filter(Boolean);

  return {
    restaurant: await reportBrand(req.auth.id),
    reportName: 'Expense Report', reportNameSo: 'Warbixinta Kharashka',
    filterLines,
    summary: [
      { label: 'Expenses · Kharashaad', value: String(rows.length) },
      { label: 'Total · Wadar', value: fmtMoney(sum) },
      { label: 'Avg · Celceli', value: fmtMoney(rows.length ? sum / rows.length : 0) },
    ],
    columns: EXPENSE_COLUMNS,
    rows,
    totalsRow: { label: 'TOTAL', values: { amount: sum } },
  };
}

function specToJson(spec) {
  return {
    reportName: spec.reportName,
    reportNameSo: spec.reportNameSo,
    filterLines: spec.filterLines,
    summary: spec.summary,
    columns: spec.columns.map((c) => ({
      header: c.header, headerSo: c.headerSo, key: c.key,
      align: c.align || 'left', format: c.format || 'text',
    })),
    rows: spec.rows,
    totalsRow: spec.totalsRow,
  };
}

async function sendXlsx(res, spec) {
  const buf = await buildXlsx(spec);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${reportFilename(spec, 'xlsx')}"`);
  res.send(Buffer.from(buf));
}

router.get('/reports/sales', requirePermission('reports'), async (req, res) => {
  res.json(specToJson(await buildSalesSpec(req)));
});
router.get('/reports/sales.xlsx', requirePermission('reports'), async (req, res) => {
  await sendXlsx(res, await buildSalesSpec(req));
});
router.get('/reports/sales.pdf', requirePermission('reports'), async (req, res) => {
  const spec = await buildSalesSpec(req);
  buildPdf(spec, res, reportFilename(spec, 'pdf'));
});

router.get('/reports/expenses', requirePermission('reports'), async (req, res) => {
  res.json(specToJson(await buildExpensesSpec(req)));
});
router.get('/reports/expenses.xlsx', requirePermission('reports'), async (req, res) => {
  await sendXlsx(res, await buildExpensesSpec(req));
});
router.get('/reports/expenses.pdf', requirePermission('reports'), async (req, res) => {
  const spec = await buildExpensesSpec(req);
  buildPdf(spec, res, reportFilename(spec, 'pdf'));
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

// ---- SMS (Hormuud / Tabaarak) ----
router.get('/sms/status', requirePermission('sms'), async (req, res) => {
  const account = await SmsAccount.findOne({ restaurant: req.auth.id }).lean();
  if (!account) return res.json({ connected: false });
  res.json({
    connected: true,
    provider: account.provider || 'hormuud',
    senderId: account.senderId,
    status: account.status,
    balanceSupported: (account.provider || 'hormuud') === 'tabaarak',
  });
});

// Live SMS credit balance (Tabaarak only — Hormuud has no balance endpoint).
router.get('/sms/balance', requirePermission('sms'), async (req, res) => {
  const account = await SmsAccount.findOne({ restaurant: req.auth.id, status: 'active' });
  if (!account) return res.status(400).json({ error: 'SMS is not connected for this restaurant' });
  if ((account.provider || 'hormuud') !== 'tabaarak') return res.json({ supported: false });
  const r = await tabaarak.getBalance({
    baseUrl: account.apiUrl,
    username: decrypt(account.username),
    password: decrypt(account.password),
  });
  if (!r.ok) return res.status(502).json({ error: `${r.description.so} · ${r.description.en}` });
  res.json({ supported: true, balance: r.balance, accountType: r.accountType });
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
  const provider = account.provider || 'hormuud';

  let sent = 0;
  let failed = 0;
  const results = [];

  if (provider === 'tabaarak') {
    // Tabaarak takes every recipient in one request and returns an aggregate result.
    const result = await tabaarak.sendSms({
      baseUrl: account.apiUrl, username, password, message: cleanMessage, mobiles: uniquePhones,
    });
    const errorText = result.ok ? null : `${result.description.so} · ${result.description.en}`;
    for (const phone of uniquePhones) {
      if (result.ok) sent += 1; else failed += 1;
      await SmsLog.create({
        restaurant: req.auth.id, phone, message: cleanMessage,
        status: result.ok ? 'sent' : 'failed', providerMessageId: null, error: errorText,
      });
      results.push({ phone, ok: result.ok, error: errorText });
    }
  } else {
    for (const phone of uniquePhones) {
      const result = await sendSms({ username, password, mobile: phone, message: cleanMessage, senderid: account.senderId, url: account.apiUrl });
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
    hasPosPin: !!s.posPinHash,
  };
}

router.get('/staff', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(staff.map(mapStaff));
});

router.post('/staff', requireOwnerOnly, async (req, res) => {
  const { name, username, password, role, permissions, posPin } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (posPin != null && posPin !== '' && !/^\d{4}$/.test(String(posPin))) {
    return res.status(400).json({ error: 'POS PIN must be exactly 4 digits · PIN-ku waa inuu ahaadaa 4 lambar' });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  const existing = await Staff.findOne({ username: cleanUsername });
  if (existing) return res.status(409).json({ error: 'Username already taken' });
  const cleanPermissions = Array.isArray(permissions) ? permissions.filter((p) => Staff.PAGE_IDS.includes(p)) : [];
  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await Staff.create({
    restaurant: req.auth.id, name, username: cleanUsername, passwordHash,
    role: role || 'Staff', permissions: cleanPermissions,
    posPinHash: posPin ? await bcrypt.hash(String(posPin), 10) : null,
  });
  res.status(201).json(mapStaff(staff));
});

router.patch('/staff/:id', requireOwnerOnly, async (req, res) => {
  const staff = await Staff.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!staff) return res.status(404).json({ error: 'Not found' });
  const { name, username, password, role, permissions, posPin } = req.body || {};
  if (posPin != null && posPin !== '' && !/^\d{4}$/.test(String(posPin))) {
    return res.status(400).json({ error: 'POS PIN must be exactly 4 digits · PIN-ku waa inuu ahaadaa 4 lambar' });
  }
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
  if (posPin) staff.posPinHash = await bcrypt.hash(String(posPin), 10);
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
