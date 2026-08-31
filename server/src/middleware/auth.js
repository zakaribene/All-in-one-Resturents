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

// Accepts either the restaurant owner or a staff account belonging to that restaurant.
// Normalizes req.auth.id to always be the restaurant's own id (so every existing
// `restaurant: req.auth.id` query in restaurant.js keeps working unchanged), and
// stashes the staff's own id + permissions for the permission-check middlewares below.
function requireRestaurantOrStaff(req, res, next) {
  authRequired(req, res, () => {
    if (req.auth.role === 'restaurant') return next();
    if (req.auth.role === 'staff') {
      req.auth.staffId = req.auth.id;
      req.auth.id = req.auth.restaurantId;
      return next();
    }
    return res.status(403).json({ error: 'Restaurant only' });
  });
}

// Owner always passes; staff must have `pageId` in their granted permissions.
function requirePermission(pageId) {
  return (req, res, next) => {
    if (req.auth.role === 'restaurant') return next();
    if (req.auth.role === 'staff' && Array.isArray(req.auth.permissions) && req.auth.permissions.includes(pageId)) return next();
    return res.status(403).json({ error: 'You do not have permission to access this · Fasax kuma lihid' });
  };
}

// Like requirePermission, but passes if staff has any one of several pages
// (used where one endpoint is shared by more than one dashboard page).
function requireAnyPermission(pageIds) {
  return (req, res, next) => {
    if (req.auth.role === 'restaurant') return next();
    if (req.auth.role === 'staff' && Array.isArray(req.auth.permissions) && pageIds.some((p) => req.auth.permissions.includes(p))) return next();
    return res.status(403).json({ error: 'You do not have permission to access this · Fasax kuma lihid' });
  };
}

// Restaurant owner only — for account-level actions (branding, staff management)
// that no staff permission should ever unlock.
function requireOwnerOnly(req, res, next) {
  if (req.auth.role !== 'restaurant') return res.status(403).json({ error: 'Owner only · Milkiile kaliya' });
  next();
}

module.exports = {
  signToken, authRequired, requireAdmin, requireRestaurant,
  requireRestaurantOrStaff, requirePermission, requireAnyPermission, requireOwnerOnly,
};
