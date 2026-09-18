const mongoose = require('mongoose');

// A person a store extends credit to ("Deyn"). `balance` is the running total they
// currently owe — incremented when an order is charged to them (POS debt order, or an
// existing pending order assigned to them later), decremented when they pay some or all
// of it back (see DebtPayment). Denormalized the same way PaymentMethod.balance is,
// rather than summed on every read.
const CustomerSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  balance: { type: Number, default: 0 },
}, { timestamps: true });

CustomerSchema.index({ restaurant: 1, name: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);
