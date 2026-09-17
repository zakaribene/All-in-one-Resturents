const mongoose = require('mongoose');

// Single-document collection for platform-wide (not per-restaurant) settings. Currently
// just the Activity Log retention policy — findOneAndUpdate with upsert on `key: 'global'`
// keeps it a true singleton without a separate "ensure it exists" bootstrap step.
const PlatformSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  // Off by default — nothing gets auto-deleted until a super admin opts in.
  activityRetentionEnabled: { type: Boolean, default: false },
  activityRetentionDays: { type: Number, default: 30, min: 1 },
}, { timestamps: true });

module.exports = mongoose.model('PlatformSetting', PlatformSettingSchema);
