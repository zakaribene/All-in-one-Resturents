const mongoose = require('mongoose');

// Restaurant-defined expense bucket (Delivery, Rent, Supplies, Salaries...).
// The owner/staff create these themselves on the Expenses page.
const ExpenseCategorySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

ExpenseCategorySchema.index({ restaurant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ExpenseCategory', ExpenseCategorySchema);
