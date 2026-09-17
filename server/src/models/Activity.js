const mongoose = require('mongoose');

// Fixed action vocabulary shown in the Activity Log's "Action" column/filter — keep in
// sync with server/src/utils/activityLog.js (which maps each to a banner/dot color) and
// the module id list there (module is free text so new pages don't need a schema change,
// but activityLog.js's MODULE_LABEL keys should stay in sync for nice display names).
const ACTIONS = ['Create', 'Update', 'Delete', 'Login'];

const ActivitySchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  message: { type: String, required: true },
  dot: { type: String, default: '#2563EB' },
  // Structured fields added for the Activity Log pages (super admin + per-store). All
  // optional/nullable so the handful of pre-existing call sites that only pass
  // restaurant/message/dot (e.g. seed.js) keep working unchanged.
  module: { type: String, default: null },
  action: { type: String, enum: [...ACTIONS, null], default: null },
  userName: { type: String, default: null },
}, { timestamps: true });

// Store's own log view (recent-first) and the retention sweep's age scan.
ActivitySchema.index({ restaurant: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1 });

ActivitySchema.statics.ACTIONS = ACTIONS;

module.exports = mongoose.model('Activity', ActivitySchema);
