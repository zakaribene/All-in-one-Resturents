const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  nameEn: { type: String, required: true, trim: true },
  nameSo: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  imageUrl: { type: String, default: '' },
  hue: { type: Number, default: () => Math.floor(Math.random() * 360) },
  sold: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
