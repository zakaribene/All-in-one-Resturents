const mongoose = require('mongoose');

// One row per manual POS collection. Feeds the "today" figure on the Payment
// Methods page and the recent-activity list. Name fields are snapshots so the
// history stays readable even after a method is renamed or deleted.
const PaymentCollectionSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  method: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
  methodName: { type: String, default: '' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: Number, default: null },
  amount: { type: Number, required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  staffName: { type: String, default: '' },
}, { timestamps: true });

PaymentCollectionSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentCollection', PaymentCollectionSchema);
