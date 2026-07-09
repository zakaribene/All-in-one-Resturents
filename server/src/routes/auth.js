const express = require('express');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const Restaurant = require('../models/Restaurant');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const admin = await AdminUser.findOne({ username: String(username).trim().toLowerCase() });
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ role: 'admin', id: admin._id.toString() });
  res.json({ token, admin: { id: admin._id, username: admin.username, name: admin.name } });
});

router.post('/restaurant/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const restaurant = await Restaurant.findOne({ username: String(username).trim().toLowerCase() });
  if (!restaurant) return res.status(401).json({ error: 'Invalid credentials' });
  if (restaurant.status === 'suspended') return res.status(403).json({ error: 'This restaurant account is suspended' });
  const ok = await bcrypt.compare(password, restaurant.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ role: 'restaurant', id: restaurant._id.toString() });
  res.json({
    token,
    restaurant: {
      id: restaurant._id, name: restaurant.name, city: restaurant.city, plan: restaurant.plan,
      hue: restaurant.hue, logoUrl: restaurant.logoUrl, coverUrl: restaurant.coverUrl,
    },
  });
});

module.exports = router;
