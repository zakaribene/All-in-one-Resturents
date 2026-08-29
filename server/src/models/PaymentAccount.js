const mongoose = require('mongoose');

const PaymentAccountSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  provider: { type: String, enum: ['evc', 'zaad', 'edahab'], required: true },
  label: { type: String, default: '' },
  baseUrl: { type: String, required: true, trim: true },
  merchantUid: { type: String, required: true },
  apiUserId: { type: String, required: true },
  apiKey: { type: String, required: true },
  currency: { type: String, enum: ['USD', 'SLSH', 'DJF'], default: 'USD' },
  isPrimary: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
}, { timestamps: true });

PaymentAccountSchema.index({ restaurant: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('PaymentAccount', PaymentAccountSchema);
