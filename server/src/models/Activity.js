const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  message: { type: String, required: true },
  dot: { type: String, default: '#2563EB' },
}, { timestamps: true });

module.exports = mongoose.model('Activity', ActivitySchema);
