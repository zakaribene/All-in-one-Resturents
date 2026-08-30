const express = require('express');
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const PaymentAccount = require('../models/PaymentAccount');
const { emitToRestaurant } = require('../socket');
const { chargeOrderPayment } = require('../utils/chargeOrder');

function mapOrderPayload(order) {
  return {
    id: order._id, number: order.number, channel: order.channel, tableLabel: order.tableLabel,
    phone: order.phone, note: order.note, items: order.items, total: order.total, status: order.status,
    payment: order.payment, createdAt: order.createdAt,
  };
}

const router = express.Router();

/**
 * @swagger
 * /public/restaurants:
 *   get:
 *     tags: [Public]
 *     summary: List active restaurants
 *     description: >
 *       For the "choose a restaurant" screen (mobile app). Only active restaurants are listed.
 *       Each entry includes `onlineCode` — pass it straight to GET /public/menu/{code} to fetch
 *       that restaurant's menu for online ordering (no physical table needed).
 *     responses:
 *       200:
 *         description: List of active restaurants.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       city: { type: string }
 *                       logoUrl: { type: string, nullable: true }
 *                       coverUrl: { type: string, nullable: true }
 *                       hue: { type: number }
 *                       onlineCode: { type: string, nullable: true, description: "Pass to GET /public/menu/{code}; null if this restaurant has no online table set up" }
 */
router.get('/restaurants', async (req, res) => {
  const restaurants = await Restaurant.find({ status: 'active' }).sort({ name: 1 }).lean();
  const onlineTables = await Table.find({ restaurant: { $in: restaurants.map(r => r._id) }, type: 'online' }).lean();
  const onlineCodeByRestaurant = new Map(onlineTables.map(t => [String(t.restaurant), t.code]));
  res.json({
    restaurants: restaurants.map(r => ({
      id: r._id, name: r.name, city: r.city, logoUrl: r.logoUrl, coverUrl: r.coverUrl, hue: r.hue,
      onlineCode: onlineCodeByRestaurant.get(String(r._id)) || null,
    })),
  });
});

/**
 * @swagger
 * /public/menu/{code}:
 *   get:
 *     tags: [Public]
 *     summary: Get a table's menu by QR code
 *     description: Scanning a table's QR code resolves to this code. Returns the restaurant, its menu (categories + products) and available payment options.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: The QR code value printed on the table.
 *     responses:
 *       200:
 *         description: Menu for this table.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 table: { type: object, properties: { code: { type: string }, label: { type: string }, type: { type: string, enum: [table, takeaway, online] } } }
 *                 restaurant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     city: { type: string }
 *                     logoUrl: { type: string, nullable: true }
 *                     coverUrl: { type: string, nullable: true }
 *                     hue: { type: number }
 *                 categories:
 *                   type: array
 *                   items: { type: object, properties: { id: { type: string }, en: { type: string }, so: { type: string } } }
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       en: { type: string }
 *                       so: { type: string }
 *                       price: { type: number }
 *                       category: { type: string }
 *                       hue: { type: number }
 *                       imageUrl: { type: string, nullable: true }
 *                 paymentOptions:
 *                   type: array
 *                   items: { type: object, properties: { provider: { type: string }, label: { type: string } } }
 *                 defaultProvider: { type: string, nullable: true }
 *       404:
 *         description: Invalid QR code, or restaurant not active.
 */
router.get('/menu/:code', async (req, res) => {
  const table = await Table.findOne({ code: req.params.code }).lean();
  if (!table) return res.status(404).json({ error: 'Invalid QR code' });
  const restaurant = await Restaurant.findById(table.restaurant).lean();
  if (!restaurant || restaurant.status !== 'active') return res.status(404).json({ error: 'Restaurant unavailable' });
  const [categories, products, paymentAccounts] = await Promise.all([
    Category.find({ restaurant: restaurant._id }).sort({ order: 1 }).lean(),
    Product.find({ restaurant: restaurant._id, status: 'active' }).lean(),
    PaymentAccount.find({ restaurant: restaurant._id, status: 'active' }).lean(),
  ]);
  const paymentOptions = paymentAccounts.map(a => ({ provider: a.provider, label: a.label || a.provider }));
  const primary = paymentAccounts.find(a => a.isPrimary) || paymentAccounts[0];
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
    paymentOptions,
    defaultProvider: primary?.provider || null,
  });
});

/**
 * @swagger
 * /public/orders:
 *   post:
 *     tags: [Public]
 *     summary: Place an order
 *     description: >
 *       Creates an order for the table/restaurant resolved from `code`. If the restaurant has an
 *       active payment account, the order is charged immediately (WaafiPay) and this call blocks
 *       until the provider responds or times out (~45s) — poll nothing, just await the response.
 *       Pass a stable `clientRequestId` so a retried request after a timeout reuses the same order
 *       instead of double-charging.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, phone, items]
 *             properties:
 *               code: { type: string, description: "Table QR code from GET /public/menu/{code}" }
 *               phone: { type: string, description: "Customer phone number (also the payment prompt number)" }
 *               note: { type: string, description: "Optional free-text note, e.g. no onions" }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, qty]
 *                   properties: { productId: { type: string }, qty: { type: integer, minimum: 1 } }
 *               paymentProvider: { type: string, description: "Required when the restaurant has more than one active payment provider" }
 *               clientRequestId: { type: string, description: "Idempotency key for payment retries; only needed when paying online" }
 *     responses:
 *       201:
 *         description: Order created (and paid, if a payment provider was used).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 number: { type: integer }
 *                 payment: { type: object, nullable: true, properties: { status: { type: string, enum: [paid] } } }
 *       400:
 *         description: Bad request — missing phone, empty cart, or invalid paymentProvider.
 *       402:
 *         description: >
 *           Payment did not succeed. `reason` (when present) carries the raw provider decline
 *           message — check it for known cases like insufficient balance before falling back to a generic message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 orderId: { type: string }
 *                 allowRetry: { type: boolean }
 *                 allowPayAtTable: { type: boolean }
 *                 needsManualVerification: { type: boolean, description: "True on timeout — the charge may have gone through anyway" }
 *                 reason: { type: string, nullable: true, description: "Raw payment-provider decline message" }
 *       404:
 *         description: Invalid QR code, or restaurant not active.
 */
router.post('/orders', async (req, res) => {
  const { code, phone, note, items, paymentProvider, clientRequestId } = req.body || {};
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
  const channel = table.type;
  const tableLabel = table.type === 'table' ? table.label : null;

  const paymentAccounts = await PaymentAccount.find({ restaurant: restaurant._id, status: 'active' }).lean();

  async function bumpSold() {
    await Product.bulkWrite(items.map(i => ({
      updateOne: { filter: { _id: i.productId }, update: { $inc: { sold: Math.max(1, Number(i.qty) || 1) } } },
    })));
  }

  // Legacy / no payment provider connected: unchanged pay-at-table flow.
  if (!paymentAccounts.length) {
    const number = restaurant.nextOrderNumber();
    await restaurant.save();
    const order = await Order.create({
      restaurant: restaurant._id, number, channel, tableLabel,
      phone: cleanPhone, note: cleanNote, items: orderItems, total, status: 'new',
    });
    await bumpSold();
    emitToRestaurant(restaurant._id, 'order:new', mapOrderPayload(order));
    return res.status(201).json({ id: order._id, number: order.number });
  }

  // Resolve which connected account to charge.
  let account;
  if (paymentProvider) {
    account = paymentAccounts.find(a => a.provider === paymentProvider);
    if (!account) return res.status(400).json({ error: 'Selected payment provider is not available' });
  } else if (paymentAccounts.length === 1) {
    account = paymentAccounts[0];
  } else {
    return res.status(400).json({ error: 'paymentProvider is required' });
  }

  // Idempotent retry: reuse the same Order document for this clientRequestId.
  let order = null;
  if (clientRequestId) {
    order = await Order.findOne({ restaurant: restaurant._id, 'payment.clientRequestId': clientRequestId });
  }

  if (order && order.payment?.status === 'paid') {
    return res.status(201).json({ id: order._id, number: order.number, payment: { status: 'paid' } });
  }

  if (!order) {
    const number = restaurant.nextOrderNumber();
    await restaurant.save();
    order = await Order.create({
      restaurant: restaurant._id, number, channel, tableLabel,
      phone: cleanPhone, note: cleanNote, items: orderItems, total, status: 'new',
      payment: {
        method: 'waafipay', provider: account.provider, status: 'pending',
        amount: total, currency: account.currency, clientRequestId: clientRequestId || null,
      },
    });
    await bumpSold();
  }

  const result = await chargeOrderPayment(order, account, { phone: cleanPhone });
  if (result.outcome === 'paid') {
    emitToRestaurant(restaurant._id, 'order:new', mapOrderPayload(order));
    return res.status(201).json({ id: order._id, number: order.number, payment: { status: 'paid' } });
  }
  return res.status(402).json(result.body);
});

/**
 * @swagger
 * /public/orders/{id}/pay-at-table:
 *   post:
 *     tags: [Public]
 *     summary: Switch a declined/failed order to pay-at-table
 *     description: Call this after a 402 from POST /public/orders when the customer chooses to pay the staff directly instead of retrying online payment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The `orderId` returned in the 402 response.
 *     responses:
 *       200:
 *         description: Order switched to pay-at-table and sent to the kitchen.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { id: { type: string }, number: { type: integer } }
 *       400:
 *         description: Order was already paid.
 *       404:
 *         description: Order not found.
 */
router.post('/orders/:id/pay-at-table', async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.payment?.status === 'paid') return res.status(400).json({ error: 'Already paid' });
  order.payment.method = 'pay_at_table';
  order.payment.status = 'none';
  await order.save();
  emitToRestaurant(order.restaurant, 'order:new', mapOrderPayload(order));
  res.json({ id: order._id, number: order.number });
});

module.exports = router;
