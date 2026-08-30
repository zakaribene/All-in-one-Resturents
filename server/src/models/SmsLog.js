const mongoose = require('mongoose');

const SmsLogSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  phone: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  providerMessageId: { type: String, default: null },
  error: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SmsLog', SmsLogSchema);
