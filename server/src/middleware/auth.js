const jwt = require('jsonwebtoken');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  authRequired(req, res, () => {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

function requireRestaurant(req, res, next) {
  authRequired(req, res, () => {
    if (req.auth.role !== 'restaurant') return res.status(403).json({ error: 'Restaurant only' });
    next();
  });
}

module.exports = { signToken, authRequired, requireAdmin, requireRestaurant };
