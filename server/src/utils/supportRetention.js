const SupportMessage = require('../models/SupportMessage');
const PlatformSetting = require('../models/PlatformSetting');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // check hourly — cheap no-op when disabled

// Per-field fallback, not just "doc missing entirely" — the singleton PlatformSetting
// document already existed (created for Activity Log retention) before these two fields
// were added to the schema, so on a real deployment the stored doc genuinely lacks them.
// .lean() skips Mongoose's own default-filling, so without this a pre-existing doc would
// read back as `undefined` (and res.json() would silently drop the key) instead of the
// documented off-by-default behavior.
async function getSupportRetentionSetting() {
  const doc = await PlatformSetting.findOne({ key: 'global' }).lean();
  return {
    supportRetentionEnabled: doc?.supportRetentionEnabled ?? false,
    supportRetentionDays: doc?.supportRetentionDays ?? 30,
  };
}

async function setSupportRetentionSetting({ enabled, days }) {
  const update = {};
  if (enabled !== undefined) update.supportRetentionEnabled = !!enabled;
  if (days !== undefined) update.supportRetentionDays = Math.max(1, Number(days) || 30);
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: 'global' }, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc;
}

// Same shape as activityRetention.js's sweep, aimed at SupportMessage instead of
// Activity — its own toggle/day-count on PlatformSetting, off by default, so clearing
// out an old back-and-forth never happens unless a super admin opts in.
function startSupportRetentionSweep() {
  async function sweep() {
    try {
      const setting = await getSupportRetentionSetting();
      if (!setting.supportRetentionEnabled) return;
      const days = Math.max(1, Number(setting.supportRetentionDays) || 30);
      const cutoff = new Date(Date.now() - days * 86400 * 1000);
      const result = await SupportMessage.deleteMany({ createdAt: { $lt: cutoff } });
      if (result.deletedCount) console.log(`[supportRetention] deleted ${result.deletedCount} messages older than ${days}d`);
    } catch (err) {
      console.error('[supportRetention] sweep failed:', err.message);
    }
  }
  sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

module.exports = { startSupportRetentionSweep, getSupportRetentionSetting, setSupportRetentionSetting };
