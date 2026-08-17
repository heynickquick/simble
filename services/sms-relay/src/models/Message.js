import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  to: { type: String, required: true },
  message: { type: String, required: true, maxlength: 1600 },
  clientId: { type: String },
  campaignId: { type: String },
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed'],
    default: 'queued',
  },
  error: { type: String },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  failedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

MessageSchema.index({ deviceId: 1, status: 1, createdAt: 1 });

export const Message = mongoose.model('Message', MessageSchema);
