require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB } = require('./db');
const { makeTableCode } = require('./utils/codes');
const mongoose = require('mongoose');

const AdminUser = require('./models/AdminUser');
const Restaurant = require('./models/Restaurant');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Table = require('./models/Table');
const Order = require('./models/Order');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');

const CATS = [
  { nameEn: 'Grill', nameSo: 'Hilib' },
  { nameEn: 'Mains', nameSo: 'Baasto' },
  { nameEn: 'Drinks', nameSo: 'Cabitaan' },
  { nameEn: 'Dessert', nameSo: 'Macmacaan' },
];

const PRODUCTS = [
  { nameEn: 'Grilled Beef', nameSo: 'Hilib Shiilan', catIdx: 0, price: 8.5, sold: 340, hue: 18 },
  { nameEn: 'Roast Chicken', nameSo: 'Digaag Duban', catIdx: 0, price: 7.0, sold: 512, hue: 35 },
  { nameEn: 'Pasta Bolognese', nameSo: 'Baasto Suugo', catIdx: 1, price: 6.0, sold: 280, hue: 12 },
  { nameEn: 'Somali Rice', nameSo: 'Bariis Iskukaris', catIdx: 1, price: 6.5, sold: 410, hue: 45 },
  { nameEn: 'Mango Juice', nameSo: 'Casiir Cambe', catIdx: 2, price: 2.5, sold: 620, hue: 32 },
  { nameEn: 'Somali Tea', nameSo: 'Shaah Somali', catIdx: 2, price: 1.0, sold: 900, hue: 25 },
  { nameEn: 'Halwa', nameSo: 'Xalwo', catIdx: 3, price: 3.0, sold: 150, hue: 355, status: 'inactive' },
  { nameEn: 'Muufo & Honey', nameSo: 'Muufo & Malab', catIdx: 3, price: 4.0, sold: 95, hue: 40 },
];

const RESTAURANTS = [
  { name: 'Beder Restaurant', owner: 'Amina Yusuf', city: 'Hargeisa', plan: 'Pro', username: 'beder', hue: 212 },
  { name: 'Xamar Grill', owner: 'Kaltuun Ali', city: 'Mogadishu', plan: 'Basic', username: 'xamargrill', hue: 150 },
  { name: 'Blue Nile Cafe', owner: 'Guled Farah', city: 'Djibouti', plan: 'Pro', username: 'bluenile', hue: 265 },
  { name: 'Salsabil Juice', owner: 'Hodan Nur', city: 'Borama', plan: 'Free', username: 'salsabil', hue: 28, status: 'suspended' },
  { name: 'New Taste', owner: 'Cabdi Jaamac', city: 'Garowe', plan: 'Basic', username: 'newtaste', hue: 340 },
  { name: 'Marina Seafood', owner: 'Faysal Warsame', city: 'Berbera', plan: 'Pro', username: 'marina', hue: 190 },
];

const TABLE_LABELS = ['A05', 'A12', 'B03', 'B07', 'C01', 'C09'];

async function run() {
  await connectDB();
  console.log('[seed] wiping existing demo collections...');
  await Promise.all([
    AdminUser.deleteMany({}), Restaurant.deleteMany({}), Category.deleteMany({}),
    Product.deleteMany({}), Table.deleteMany({}), Order.deleteMany({}),
    Activity.deleteMany({}), Notification.deleteMany({}),
  ]);

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await AdminUser.create({ username: 'admin', passwordHash: adminPasswordHash, name: 'Super Admin' });
  console.log('[seed] admin login -> username: admin / password: admin123');

  const restPasswordHash = await bcrypt.hash('restaurant123', 10);

  for (const r of RESTAURANTS) {
    const restaurant = await Restaurant.create({
      name: r.name, city: r.city, ownerName: r.owner, username: r.username,
      passwordHash: restPasswordHash, plan: r.plan, status: r.status || 'active', hue: r.hue,
      orderSeq: 1040,
    });

    const cats = await Category.insertMany(CATS.map((c, i) => ({ restaurant: restaurant._id, nameEn: c.nameEn, nameSo: c.nameSo, order: i })));

    const products = await Product.insertMany(PRODUCTS.map(p => ({
      restaurant: restaurant._id, category: cats[p.catIdx]._id, nameEn: p.nameEn, nameSo: p.nameSo,
      price: p.price, sold: p.sold, hue: p.hue, status: p.status || 'active',
    })));

    const tables = await Table.insertMany([
      ...TABLE_LABELS.map(label => ({ restaurant: restaurant._id, label, type: 'table', code: makeTableCode() })),
      { restaurant: restaurant._id, label: 'Takeaway', type: 'takeaway', code: makeTableCode() },
      { restaurant: restaurant._id, label: 'Online', type: 'online', code: makeTableCode() },
    ]);

    // Only Beder gets the demo orders shown in the original prototype, to keep others clean.
    if (r.username === 'beder') {
      const byName = (n) => products.find(p => p.nameEn === n);
      const byLabel = (l) => tables.find(t => t.label === l);
      await Order.insertMany([
        { restaurant: restaurant._id, number: 1042, channel: 'table', tableLabel: 'A12', phone: '063 4412200', items: [{ name: 'Grilled Beef', qty: 2, price: 8.5 }, { name: 'Mango Juice', qty: 2, price: 2.5 }], total: 22.0, status: 'new', createdAt: new Date(Date.now() - 1 * 60000) },
        { restaurant: restaurant._id, number: 1041, channel: 'table', tableLabel: 'B03', phone: '063 7789112', items: [{ name: 'Somali Rice', qty: 1, price: 6.5 }, { name: 'Somali Tea', qty: 2, price: 1.0 }], total: 8.5, status: 'preparing', createdAt: new Date(Date.now() - 6 * 60000) },
        { restaurant: restaurant._id, number: 1040, channel: 'online', tableLabel: null, phone: '065 5540098', items: [{ name: 'Pasta Bolognese', qty: 1, price: 6.0 }], total: 6.0, status: 'preparing', createdAt: new Date(Date.now() - 12 * 60000) },
        { restaurant: restaurant._id, number: 1039, channel: 'table', tableLabel: 'A05', phone: '063 2231470', items: [{ name: 'Roast Chicken', qty: 3, price: 7.0 }], total: 21.0, status: 'done', createdAt: new Date(Date.now() - 20 * 60000) },
      ]);
      restaurant.orderSeq = 1042;
      await restaurant.save();
    }

    await Activity.create({ restaurant: restaurant._id, message: `${restaurant.name} joined · ${restaurant.plan} plan`, dot: restaurant.status === 'suspended' ? '#E5484D' : '#12A150' });
    console.log(`[seed] ${restaurant.name} -> username: ${restaurant.username} / password: restaurant123`);
  }

  console.log('[seed] done.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
