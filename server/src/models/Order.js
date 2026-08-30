const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['pay_at_table', 'waafipay'], default: 'pay_at_table' },
  provider: { type: String, enum: ['evc', 'zaad', 'edahab', null], default: null },
  status: { type: String, enum: ['none', 'pending', 'paid', 'declined', 'failed', 'timeout'], default: 'none' },
  amount: { type: Number, default: null },
  currency: { type: String, default: null },
  referenceId: { type: String, default: null },
  invoiceId: { type: String, default: null },
  transactionId: { type: String, default: null },
  issuerTransactionId: { type: String, default: null },
  clientRequestId: { type: String, default: undefined },
  failureReason: { type: String, default: null },
  paidAt: { type: Date, default: null },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  number: { type: Number, required: true },
  channel: { type: String, enum: ['table', 'takeaway', 'online', 'pos'], required: true },
  tableLabel: { type: String, default: null },
  phone: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
  items: { type: [OrderItemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  total: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['new', 'preparing', 'done'], default: 'new' },
  payment: { type: PaymentSchema, default: () => ({}) },
}, { timestamps: true });

OrderSchema.index(
  { restaurant: 1, 'payment.clientRequestId': 1 },
  { unique: true, partialFilterExpression: { 'payment.clientRequestId': { $type: 'string' } } },
);

module.exports = mongoose.model('Order', OrderSchema);
