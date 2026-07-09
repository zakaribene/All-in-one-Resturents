const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  nameEn: { type: String, required: true, trim: true },
  nameSo: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
