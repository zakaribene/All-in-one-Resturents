const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['table', 'takeaway', 'online'], default: 'table' },
  code: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Table', TableSchema);
