const mongoose = require('mongoose');

// One row per settlement against a customer's debt balance — full or partial. Deliberately
// not tied to a single Order (a customer's balance can span several debt orders, and a
// payment settles the *balance*, not one specific order), unlike PaymentCollection. The
// method fields are snapshots so history stays readable even if a wallet is later renamed.
const DebtPaymentSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  amount: { type: Number, required: true },
  method: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
  methodName: { type: String, default: '' },
  staffName: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DebtPayment', DebtPaymentSchema);
