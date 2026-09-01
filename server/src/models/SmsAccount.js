const mongoose = require('mongoose');

const SmsAccountSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, unique: true, index: true },
  provider: { type: String, enum: ['hormuud', 'tabaarak'], default: 'hormuud' },
  username: { type: String, required: true },
  password: { type: String, required: true },
  senderId: { type: String, default: '' },
  apiUrl: { type: String, default: 'https://smsapi.hormuud.com/api/sms/Send', trim: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('SmsAccount', SmsAccountSchema);
