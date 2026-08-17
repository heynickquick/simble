import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  phone: { type: String, required: true, index: true },
  // Channel-specific IDs (a contact can have multiple)
  chatId: { type: String, default: '' }, // Telegram chat_id
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  customFields: { type: Map, of: String, default: {} },
  optedOut: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// One contact per phone per client
ContactSchema.index({ clientId: 1, phone: 1 }, { unique: true });

export const Contact = mongoose.model('Contact', ContactSchema);
