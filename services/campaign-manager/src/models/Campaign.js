import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  phone: { type: String },
  channel: { type: String, default: 'sms' },
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed'],
    default: 'queued',
  },
  externalId: { type: String }, // textbee message ID or channel-specific ID
  error: { type: String },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
}, { _id: true });

const CampaignSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  name: { type: String, required: true },
  message: { type: String, required: true, maxlength: 1600 },
  // Phase 5: 'sms' | 'telegram' | 'whatsapp' | 'viber' | 'line' | 'zalo'
  channel: { type: String, default: 'sms' },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft',
  },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  // Throttle per message (ms) — 2000 = 1 msg / 2 sec, friendly to consumer SIMs
  throttleMs: { type: Number, default: 2000 },
  messages: [MessageSchema],
  stats: {
    total: { type: Number, default: 0 },
    queued: { type: Number, default: 0 },
    sending: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

CampaignSchema.index({ status: 1, scheduledAt: 1 });

export const Campaign = mongoose.model('Campaign', CampaignSchema);
