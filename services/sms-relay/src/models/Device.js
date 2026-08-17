import mongoose from 'mongoose';
import crypto from 'crypto';

const DeviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, default: '' },
  token: { type: String, required: true, unique: true, index: true },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  batteryLevel: { type: Number, default: null },
  networkType: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

// Generate a secure token before validation
DeviceSchema.pre('validate', function (next) {
  if (!this.token) {
    this.token = 'sim_' + crypto.randomBytes(24).toString('hex');
  }
  next();
});

DeviceSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    phoneNumber: this.phoneNumber,
    token: this.token, // returned on creation; protect elsewhere
    online: this.online,
    lastSeen: this.lastSeen,
    batteryLevel: this.batteryLevel,
    networkType: this.networkType,
    createdAt: this.createdAt,
  };
};

export const Device = mongoose.model('Device', DeviceSchema);
