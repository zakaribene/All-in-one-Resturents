const mongoose = require('mongoose');

// One row per settlement against a customer's debt balance — full or partial. The total
// amount isn't tied to a single Order (a customer's balance can span several debt orders),
// unlike PaymentCollection — but `appliedTo` records exactly which order(s) it paid down
// and by how much (see /customers/:id/payments and /orders/:id/settle-debt), so an undo
// knows precisely what to reverse without having to guess from amount/time proximity.
// Empty for a payment made before this field existed, or one that didn't match any order's
// remaining balance (shouldn't normally happen — see the FIFO distribution loop).
const DebtPaymentSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  amount: { type: Number, required: true },
  method: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
  methodName: { type: String, default: '' },
  staffName: { type: String, default: '' },
  note: { type: String, default: '' },
  appliedTo: {
    type: [{
      order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      orderNumber: { type: Number, required: true },
      amount: { type: Number, required: true },
    }],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('DebtPayment', DebtPaymentSchema);
