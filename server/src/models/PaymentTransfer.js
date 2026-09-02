const mongoose = require('mongoose');

// One row per wallet-to-wallet move (e.g. EVC $50 -> eDahab). Debits the
// `from` PaymentMethod balance and credits the `to` one. Name fields are
// snapshots so the history stays readable after a method is renamed/deleted.
const PaymentTransferSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  fromMethod: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
  fromMethodName: { type: String, default: '' },
  toMethod: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
  toMethodName: { type: String, default: '' },
  amount: { type: Number, required: true },
  note: { type: String, default: '', trim: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  staffName: { type: String, default: '' },
}, { timestamps: true });

PaymentTransferSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentTransfer', PaymentTransferSchema);
