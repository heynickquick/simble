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
  // IANA timezone string, e.g. "America/Asuncion", "America/New_York".
  // Used for timezone-aware throttling (don't send outside 9am-9pm device local).
  timezone: { type: String, default: 'UTC' },
  // Hourly cap as a safety net against runaway sends. The sms-relay refuses
  // sends when smsThisHour >= smsPerHour.
  smsPerHour: { type: Number, default: 100 },
  smsThisHour: { type: Number, default: 0 },
  hourResetAt: { type: Date, default: () => new Date() },
  // Sending window in device local time. 9am-9pm by default.
  sendWindowStartHour: { type: Number, default: 9 },
  sendWindowEndHour: { type: Number, default: 21 },
  createdAt: { type: Date, default: Date.now },
});

// Generate a secure token before validation
DeviceSchema.pre('validate', function (next) {
  if (!this.token) {
    this.token = 'sim_' + crypto.randomBytes(24).toString('hex');
  }
  next();
});

// Reset the hourly counter if we've crossed an hour boundary
DeviceSchema.methods.resetHourlyIfNeeded = function () {
  const now = new Date();
  if (now - this.hourResetAt >= 60 * 60 * 1000) {
    this.smsThisHour = 0;
    this.hourResetAt = now;
  }
};

// Check if the current device-local time is within the send window.
// Returns { allowed: bool, reason: string? }
DeviceSchema.methods.isWithinSendWindow = function () {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    const hour = hourPart ? parseInt(hourPart.value, 10) : 12;
    const start = this.sendWindowStartHour;
    const end = this.sendWindowEndHour;
    if (hour < start || hour >= end) {
      return { allowed: false, reason: `outside send window (${start}:00-${end}:00 ${this.timezone}, current hour: ${hour})` };
    }
    return { allowed: true };
  } catch (e) {
    // Invalid timezone — fail open
    return { allowed: true };
  }
};

DeviceSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    phoneNumber: this.phoneNumber,
    token: this.token,
    online: this.online,
    lastSeen: this.lastSeen,
    batteryLevel: this.batteryLevel,
    networkType: this.networkType,
    timezone: this.timezone,
    smsPerHour: this.smsPerHour,
    smsThisHour: this.smsThisHour,
    hourResetAt: this.hourResetAt,
    sendWindowStartHour: this.sendWindowStartHour,
    sendWindowEndHour: this.sendWindowEndHour,
    createdAt: this.createdAt,
  };
};

export const Device = mongoose.model('Device', DeviceSchema);
