const mongoose = require('mongoose');

const PAGE_IDS = ['overview', 'orders', 'pos', 'payments', 'sms', 'products', 'categories', 'qr'];

const StaffSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'Staff', trim: true },
  permissions: {
    type: [String],
    default: [],
    validate: { validator: (v) => v.every((p) => PAGE_IDS.includes(p)), message: 'Invalid permission page id' },
  },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

StaffSchema.statics.PAGE_IDS = PAGE_IDS;

module.exports = mongoose.model('Staff', StaffSchema);
