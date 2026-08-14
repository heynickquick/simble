import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  plan: { type: String, enum: ['starter', 'growth', 'agency'], default: 'starter' },
  // textbee device this client sends from (set at signup, admin can change)
  deviceId: { type: String, required: true },
  limits: {
    smsPerMonth: { type: Number, default: 500 },
    contactsMax: { type: Number, default: 1000 },
  },
  usage: {
    smsThisMonth: { type: Number, default: 0 },
    monthResetAt: { type: Date, default: () => new Date() },
  },
  stripeCustomerId: { type: String },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

ClientSchema.methods.resetUsageIfNeeded = function () {
  const now = new Date();
  const last = this.usage.monthResetAt;
  if (now - last > 30 * 24 * 60 * 60 * 1000) {
    this.usage.smsThisMonth = 0;
    this.usage.monthResetAt = now;
  }
};

ClientSchema.methods.toSafeJSON = function () {
  const o = this.toObject();
  delete o.passwordHash;
  return o;
};

export const Client = mongoose.model('Client', ClientSchema);
