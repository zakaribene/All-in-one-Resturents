const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');

// "PaymentCollection" -> "Payment Collections", "ExpenseCategory" -> "Expense Categories"
function humanizeLabel(modelName) {
  const spaced = modelName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.endsWith('y') ? `${spaced.slice(0, -1)}ies` : `${spaced}s`;
}

// Reflects on every model Mongoose has registered and picks out the ones that
// carry a `restaurant` ObjectId ref — i.e. every tenant-scoped collection in
// the app. A brand new model automatically shows up here with zero extra
// wiring, as long as it declares its restaurant ref the same way the rest of
// the codebase does. The Restaurant document itself is appended separately
// since it doesn't reference itself — it *is* the tenant.
function scopedModels() {
  const items = mongoose.modelNames()
    .filter((name) => name !== 'Restaurant')
    .map((name) => {
      const Model = mongoose.model(name);
      const path = Model.schema.path('restaurant');
      if (!path || path.instance !== 'ObjectId' || path.options?.ref !== 'Restaurant') return null;
      return { id: name, label: humanizeLabel(name), Model, filterKey: 'restaurant', isAccount: false };
    })
    .filter(Boolean);
  items.push({ id: 'Restaurant', label: 'Restaurant account · Xisaabta maqaayadda', Model: Restaurant, filterKey: '_id', isAccount: true });
  return items;
}

async function dataSummary(restaurantId) {
  const items = scopedModels();
  const counts = await Promise.all(items.map((it) => it.Model.countDocuments({ [it.filterKey]: restaurantId })));
  return items.map((it, i) => ({ id: it.id, label: it.label, count: counts[i], isAccount: it.isAccount }));
}

async function purgeData(restaurantId, ids) {
  const wanted = new Set(ids);
  const items = scopedModels().filter((it) => wanted.has(it.id));
  // Delete everything else before the account doc, so nothing is left orphaned mid-way.
  const ordered = [...items.filter((it) => !it.isAccount), ...items.filter((it) => it.isAccount)];
  const results = [];
  for (const it of ordered) {
    const res = await it.Model.deleteMany({ [it.filterKey]: restaurantId });
    results.push({ id: it.id, label: it.label, deletedCount: res.deletedCount });
  }
  return results;
}

module.exports = { scopedModels, dataSummary, purgeData };
