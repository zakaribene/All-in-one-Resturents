const Activity = require('../models/Activity');

// Display name + filter-dropdown source for the "Module" column, keyed by the same short
// ids used as `module` on Activity docs. Free text on the schema (so a new module never
// needs a migration) but every call site below should use one of these ids.
const MODULE_LABEL = {
  auth: 'Auth',
  overview: 'Overview',
  orders: 'Orders',
  pos: 'POS',
  payments: 'Payments',
  paymethods: 'Payment Methods',
  transfers: 'Transfers',
  expenses: 'Expenses',
  products: 'Products',
  categories: 'Categories',
  qr: 'QR / Tables',
  sms: 'SMS',
  staff: 'Staff',
  settings: 'Settings',
  subscription: 'Subscription',
  restaurant: 'Restaurant',
  data: 'Data',
  support: 'Support',
};

const ACTION_DOT = {
  Create: '#12A150',
  Update: '#2563EB',
  Delete: '#E5484D',
  Login: '#8B5CF6',
};

// Fire-and-forget: an activity-log write should never be the reason a real request fails.
// `restaurant` is a Restaurant _id (or null for a platform-level event with no single
// owner). `userName` is whoever performed it — see req.auth.name, populated at login.
function logActivity({ restaurant = null, userName, module, action, message }) {
  Activity.create({
    restaurant, userName: userName || null, module, action, message,
    dot: ACTION_DOT[action] || '#2563EB',
  }).catch((err) => console.error('[activityLog] failed to write:', err.message));
}

// Convenience wrapper for restaurant/staff-scoped routes — req.auth.id is already
// normalized to the restaurant id by requireRestaurantOrStaff, and req.auth.name is
// stamped on the JWT at login (owner name or staff name).
function logStoreActivity(req, { module, action, message }) {
  logActivity({
    restaurant: req.auth.id,
    userName: req.auth.name || (req.auth.role === 'staff' ? 'Staff' : 'Owner'),
    module, action, message,
  });
}

module.exports = { logActivity, logStoreActivity, MODULE_LABEL, ACTION_DOT };
