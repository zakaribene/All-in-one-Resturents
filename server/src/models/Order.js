const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  number: { type: Number, required: true },
  channel: { type: String, enum: ['table', 'takeaway', 'online'], required: true },
  tableLabel: { type: String, default: null },
  phone: { type: String, required: true, trim: true },
  items: { type: [OrderItemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['new', 'preparing', 'done'], default: 'new' },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
