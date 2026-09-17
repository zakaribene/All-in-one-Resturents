const Activity = require('../models/Activity');
const PlatformSetting = require('../models/PlatformSetting');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // check hourly — cheap no-op when disabled

async function getRetentionSetting() {
  let doc = await PlatformSetting.findOne({ key: 'global' }).lean();
  if (!doc) doc = { activityRetentionEnabled: false, activityRetentionDays: 30 };
  return doc;
}

async function setRetentionSetting({ enabled, days }) {
  const update = {};
  if (enabled !== undefined) update.activityRetentionEnabled = !!enabled;
  if (days !== undefined) update.activityRetentionDays = Math.max(1, Number(days) || 30);
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: 'global' }, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc;
}

// Runs once at boot and then every SWEEP_INTERVAL_MS. Off by default (activityRetentionEnabled
// starts false) — deletion only ever runs after a super admin explicitly opts in via
// /admin/activity-log/retention, and it only ever deletes Activity documents (the log
// itself), never any store data. Silent no-op on any read/delete error — a sweep is
// never allowed to crash the server.
function startActivityRetentionSweep() {
  async function sweep() {
    try {
      const setting = await getRetentionSetting();
      if (!setting.activityRetentionEnabled) return;
      const days = Math.max(1, Number(setting.activityRetentionDays) || 30);
      const cutoff = new Date(Date.now() - days * 86400 * 1000);
      const result = await Activity.deleteMany({ createdAt: { $lt: cutoff } });
      if (result.deletedCount) console.log(`[activityRetention] deleted ${result.deletedCount} entries older than ${days}d`);
    } catch (err) {
      console.error('[activityRetention] sweep failed:', err.message);
    }
  }
  sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

module.exports = { startActivityRetentionSweep, getRetentionSetting, setRetentionSetting };
