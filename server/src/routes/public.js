const express = require('express');
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { emitToRestaurant } = require('../socket');

const router = express.Router();

router.get('/menu/:code', async (req, res) => {
  const table = await Table.findOne({ code: req.params.code }).lean();
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });
  const restaurant = await Restaurant.findById(table.restaurant).lean();
  if (!restaurant || restaurant.status !== 'active') return res.status(404).json({ error: 'Restaurant unavailable' });
  const [categories, products] = await Promise.all([
    Category.find({ restaurant: restaurant._id }).sort({ order: 1 }).lean(),
    Product.find({ restaurant: restaurant._id, status: 'active' }).lean(),
  ]);
  res.json({
    table: { code: table.code, label: table.label, type: table.type },
    restaurant: {
      id: restaurant._id, name: restaurant.name, city: restaurant.city,
      logoUrl: restaurant.logoUrl, coverUrl: restaurant.coverUrl, hue: restaurant.hue,
    },
    categories: categories.map(c => ({ id: c._id, en: c.nameEn, so: c.nameSo })),
    products: products.map(p => ({
      id: p._id, en: p.nameEn, so: p.nameSo, price: p.price, category: p.category, hue: p.hue, imageUrl: p.imageUrl,
    })),
  });
});

router.post('/orders', async (req, res) => {
  const { code, phone, note, items } = req.body || {};
  const cleanPhone = String(phone || '').trim();
  const cleanNote = String(note || '').trim();
  if (!cleanPhone) return res.status(400).json({ error: 'Phone number is required' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });

  const table = await Table.findOne({ code }).lean();
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });
  const restaurant = await Restaurant.findById(table.restaurant);
  if (!restaurant || restaurant.status !== 'active') return res.status(404).json({ error: 'Restaurant unavailable' });

  const productIds = items.map(i => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, restaurant: restaurant._id, status: 'active' }).lean();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  const orderItems = [];
  for (const i of items) {
    const p = productMap.get(String(i.productId));
    const qty = Math.max(1, Number(i.qty) || 1);
    if (!p) continue;
    orderItems.push({ name: p.nameEn, qty, price: p.price });
  }
  if (!orderItems.length) return res.status(400).json({ error: 'No valid items in cart' });

  const total = orderItems.reduce((a, i) => a + i.price * i.qty, 0);
  const number = restaurant.nextOrderNumber();
  await restaurant.save();

  const order = await Order.create({
    restaurant: restaurant._id, number, channel: table.type,
    tableLabel: table.type === 'table' ? table.label : null,
    phone: cleanPhone, note: cleanNote, items: orderItems, total, status: 'new',
  });

  await Product.bulkWrite(items.map(i => ({
    updateOne: { filter: { _id: i.productId }, update: { $inc: { sold: Math.max(1, Number(i.qty) || 1) } } },
  })));

  const payload = {
    id: order._id, number: order.number, channel: order.channel, tableLabel: order.tableLabel,
    phone: order.phone, note: order.note, items: order.items, total: order.total, status: order.status, createdAt: order.createdAt,
  };
  emitToRestaurant(restaurant._id, 'order:new', payload);

  res.status(201).json({ id: order._id, number: order.number });
});

module.exports = router;
