const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Table = require('../models/Table');
const Order = require('../models/Order');
const { requireRestaurant } = require('../middleware/auth');
const { makeTableCode } = require('../utils/codes');
const { emitToRestaurant } = require('../socket');

const router = express.Router();
router.use(requireRestaurant);

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
  res.json({
    id: r._id, name: r.name, city: r.city, ownerName: r.ownerName, plan: r.plan,
    hue: r.hue, logoUrl: r.logoUrl, coverUrl: r.coverUrl,
  });
});

router.post('/upload', upload.single('image'), async (req, res) => {
  const { kind } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!['logo', 'cover'].includes(kind)) return res.status(400).json({ error: 'kind must be logo or cover' });
  const url = `/uploads/${req.file.filename}`;
  const field = kind === 'logo' ? 'logoUrl' : 'coverUrl';
  await Restaurant.findByIdAndUpdate(req.auth.id, { [field]: url });
  res.json({ url });
});

// ---- Categories ----
router.get('/categories', async (req, res) => {
  const cats = await Category.find({ restaurant: req.auth.id }).sort({ order: 1, createdAt: 1 }).lean();
  res.json(cats.map(c => ({ id: c._id, en: c.nameEn, so: c.nameSo })));
});

router.post('/categories', async (req, res) => {
  const { nameEn, nameSo } = req.body || {};
  if (!nameEn || !nameSo) return res.status(400).json({ error: 'nameEn and nameSo are required' });
  const count = await Category.countDocuments({ restaurant: req.auth.id });
  const cat = await Category.create({ restaurant: req.auth.id, nameEn, nameSo, order: count });
  res.status(201).json({ id: cat._id, en: cat.nameEn, so: cat.nameSo });
});

router.patch('/categories/:id', async (req, res) => {
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

router.delete('/categories/:id', async (req, res) => {
  const inUse = await Product.countDocuments({ restaurant: req.auth.id, category: req.params.id });
  if (inUse > 0) return res.status(409).json({ error: 'Category has products, move or delete them first' });
  const cat = await Category.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!cat) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Products ----
router.get('/products', async (req, res) => {
  const products = await Product.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).lean();
  res.json(products.map(mapProduct));
});

function mapProduct(p) {
  return {
    id: p._id, en: p.nameEn, so: p.nameSo, price: p.price, status: p.status,
    category: p.category, imageUrl: p.imageUrl, hue: p.hue, sold: p.sold,
  };
}

router.post('/products', upload.single('image'), async (req, res) => {
  const { nameEn, nameSo, price, category } = req.body || {};
  if (!nameEn || !nameSo || price == null || !category) return res.status(400).json({ error: 'nameEn, nameSo, price, category are required' });
  const cat = await Category.findOne({ _id: category, restaurant: req.auth.id });
  if (!cat) return res.status(400).json({ error: 'Invalid category' });
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const p = await Product.create({ restaurant: req.auth.id, category, nameEn, nameSo, price: Number(price), imageUrl });
  res.status(201).json(mapProduct(p));
});

router.post('/products/:id/image', upload.single('image'), async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  p.imageUrl = `/uploads/${req.file.filename}`;
  await p.save();
  res.json(mapProduct(p));
});

router.patch('/products/:id/toggle', async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.status = p.status === 'active' ? 'inactive' : 'active';
  await p.save();
  res.json(mapProduct(p));
});

router.patch('/products/:id', upload.single('image'), async (req, res) => {
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

router.delete('/products/:id', async (req, res) => {
  const p = await Product.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- Tables ----
router.get('/tables', async (req, res) => {
  const tables = await Table.find({ restaurant: req.auth.id }).sort({ createdAt: 1 }).lean();
  res.json(tables.map(t => ({ id: t._id, label: t.label, type: t.type, code: t.code })));
});

router.post('/tables', async (req, res) => {
  const { label } = req.body || {};
  const clean = String(label || '').trim().toUpperCase();
  if (!clean) return res.status(400).json({ error: 'label required' });
  const existing = await Table.findOne({ restaurant: req.auth.id, type: 'table', label: clean });
  if (existing) return res.json({ id: existing._id, label: existing.label, type: existing.type, code: existing.code });
  const t = await Table.create({ restaurant: req.auth.id, label: clean, type: 'table', code: makeTableCode() });
  res.status(201).json({ id: t._id, label: t.label, type: t.type, code: t.code });
});

// ---- Orders ----
router.get('/orders', async (req, res) => {
  const orders = await Order.find({ restaurant: req.auth.id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(orders.map(mapOrder));
});

function mapOrder(o) {
  return {
    id: o._id, number: o.number, channel: o.channel, tableLabel: o.tableLabel, phone: o.phone, note: o.note,
    items: o.items, total: o.total, status: o.status, createdAt: o.createdAt,
  };
}

router.post('/orders/:id/accept', async (req, res) => {
  const o = await Order.findOneAndUpdate({ _id: req.params.id, restaurant: req.auth.id }, { status: 'preparing' }, { new: true });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(mapOrder(o));
});

router.post('/orders/:id/complete', async (req, res) => {
  const o = await Order.findOneAndUpdate({ _id: req.params.id, restaurant: req.auth.id }, { status: 'done' }, { new: true });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(mapOrder(o));
});

router.delete('/orders/:id', async (req, res) => {
  const o = await Order.findOneAndDelete({ _id: req.params.id, restaurant: req.auth.id });
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/orders/simulate', async (req, res) => {
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

// ---- Sales ----
router.get('/sales', async (req, res) => {
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

module.exports = router;
