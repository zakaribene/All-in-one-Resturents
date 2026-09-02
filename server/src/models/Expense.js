const mongoose = require('mongoose');

// One row per money-out event, paid from a manual PaymentMethod wallet
// (e.g. "Delivery $1 paid from EVC"). The wallet's running balance is
// decremented when the expense is recorded and credited back if it is
// deleted. Name fields are snapshots so history survives renames/deletes.
const ExpenseSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', default: null },
  categoryName: { type: String, default: '' },
  method: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', default: null },
  methodName: { type: String, default: '' },
  amount: { type: Number, required: true },
  note: { type: String, default: '', trim: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  staffName: { type: String, default: '' },
}, { timestamps: true });

ExpenseSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
