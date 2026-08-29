const express = require('express');
const Table = require('../models/Table');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const PaymentAccount = require('../models/PaymentAccount');
const { emitToRestaurant } = require('../socket');
const { decrypt } = require('../utils/crypto');
const waafipay = require('../utils/waafipay');

function mapOrderPayload(order) {
  return {
    id: order._id, number: order.number, channel: order.channel, tableLabel: order.tableLabel,
    phone: order.phone, note: order.note, items: order.items, total: order.total, status: order.status,
    payment: order.payment, createdAt: order.createdAt,
  };
}

const router = express.Router();

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

  order.payment.referenceId = String(order._id);
  order.payment.invoiceId = 'INV-' + order._id;
  order.payment.status = 'pending';
  order.payment.provider = account.provider;
  order.payment.amount = total;
  order.payment.currency = account.currency;
  await order.save();

  const decryptedAccount = {
    baseUrl: account.baseUrl,
    merchantUid: account.merchantUid,
    apiUserId: decrypt(account.apiUserId),
    apiKey: decrypt(account.apiKey),
    currency: account.currency,
  };

  const result = await waafipay.chargePurchase(decryptedAccount, {
    referenceId: order.payment.referenceId,
    invoiceId: order.payment.invoiceId,
    amount: total,
    phone: cleanPhone,
    description: `Order #${order.number}`,
  });

  if (result.ok) {
    order.payment.status = 'paid';
    order.payment.transactionId = result.transactionId;
    order.payment.issuerTransactionId = result.issuerTransactionId;
    order.payment.paidAt = new Date();
    await order.save();
    emitToRestaurant(restaurant._id, 'order:new', mapOrderPayload(order));
    return res.status(201).json({ id: order._id, number: order.number, payment: { status: 'paid' } });
  }

  if (result.timeout) {
    order.payment.status = 'timeout';
    await order.save();
    return res.status(402).json({
      error: 'Lama xaqiijin lacag-bixinta · Payment could not be confirmed in time',
      orderId: order._id, allowRetry: false, allowPayAtTable: true, needsManualVerification: true,
    });
  }

  if (result.networkError) {
    order.payment.status = 'failed';
    await order.save();
    return res.status(402).json({
      error: 'Adeegga lacag-bixinta lama gaarin · Could not reach the payment provider, please try again',
      orderId: order._id, allowRetry: true, allowPayAtTable: true,
    });
  }

  order.payment.status = 'declined';
  order.payment.failureReason = result.raw?.responseMsg || result.state || null;
  await order.save();
  return res.status(402).json({
    error: 'Lacagta lama aqbalin · Payment was declined',
    orderId: order._id, allowRetry: true, allowPayAtTable: true,
  });
});

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
