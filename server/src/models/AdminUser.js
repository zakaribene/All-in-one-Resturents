const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, default: 'Super Admin' },
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', AdminUserSchema);
