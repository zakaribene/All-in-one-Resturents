const mongoose = require('mongoose');

// Restaurant-defined manual payment wallet (EVC, eDahab, Cash, Bank...). Its
// `balance` is a running total that POS bumps whenever a manual order is
// collected against it. Unrelated to the WaafiPay `PaymentAccount` gateways.
const PaymentMethodSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
}, { timestamps: true });

PaymentMethodSchema.index({ restaurant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);
