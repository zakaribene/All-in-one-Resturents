const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  scope: { type: String, enum: ['all', 'single'], required: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  title: { type: String, required: true, trim: true },
  body: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
