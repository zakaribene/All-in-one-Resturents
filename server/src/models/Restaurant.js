const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  plan: { type: String, enum: ['Free', 'Basic', 'Pro'], default: 'Free' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  hue: { type: Number, default: () => Math.floor(Math.random() * 360) },
  logoUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  orderSeq: { type: Number, default: 1000 },
}, { timestamps: true });

RestaurantSchema.methods.nextOrderNumber = function () {
  this.orderSeq += 1;
  return this.orderSeq;
};

module.exports = mongoose.model('Restaurant', RestaurantSchema);
