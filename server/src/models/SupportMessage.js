const mongoose = require('mongoose');

// One flat collection for every store's conversation with platform support — each
// restaurant has exactly one thread (its own messages, filtered by `restaurant`), not
// per-topic threads. `sender` says which side of the conversation wrote it; the two
// read flags default opposite so a fresh message is unread on the *other* side and
// already-read on the side that sent it, without a separate read-receipt collection.
const SupportMessageSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  sender: { type: String, enum: ['restaurant', 'admin'], required: true },
  senderName: { type: String, default: '' },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  readByRestaurant: { type: Boolean, default: function () { return this.sender === 'restaurant'; } },
  readByAdmin: { type: Boolean, default: function () { return this.sender === 'admin'; } },
}, { timestamps: true });

SupportMessageSchema.index({ restaurant: 1, createdAt: 1 });
SupportMessageSchema.index({ createdAt: 1 }); // retention sweep

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);
