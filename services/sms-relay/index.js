// Simble SMS relay — bridges campaign-manager to phones via long-polling (no FCM).
//
// Architecture:
//   campaign-manager  →  POST /messages  →  sms-relay  →  long-poll  →  phone-agent (Termux)  →  SMS via Android API
//   phone-agent      →  POST /messages/:id/report  →  sms-relay  →  webhook  →  campaign-manager
//
// Phone-agent authenticates with a per-device token (created on device registration).
// campaign-manager authenticates with SMS_RELAY_SECRET (server-to-server).

import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import QRCode from 'qrcode';
import 'dotenv/config';

import { Message } from './src/models/Message.js';
import { Device } from './src/models/Device.js';
import { authMiddleware, serverAuthMiddleware } from './src/middleware/auth.js';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (_, res) => res.json({ ok: true, service: 'sms-relay', uptime: process.uptime() }));

// ===== Device registration (from web UI / campaign-manager) =====
app.post('/devices', serverAuthMiddleware, async (req, res, next) => {
  try {
    const { name, phoneNumber } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const device = await Device.create({ name, phoneNumber });
    res.json(device.toSafeJSON());
  } catch (e) { next(e); }
});

app.get('/devices', serverAuthMiddleware, async (req, res, next) => {
  try {
    const devices = await Device.find().sort('-createdAt');
    res.json(devices.map(d => d.toSafeJSON()));
  } catch (e) { next(e); }
});

// Admin: update a device (timezone, smsPerHour, send window, name, phoneNumber)
app.patch('/devices/:id', serverAuthMiddleware, async (req, res, next) => {
  try {
    const allowed = ['name', 'phoneNumber', 'timezone', 'smsPerHour', 'sendWindowStartHour', 'sendWindowEndHour'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    const d = await Device.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!d) return res.status(404).json({ error: 'not found' });
    res.json(d.toSafeJSON());
  } catch (e) { next(e); }
});

app.get('/devices/:token/status', async (req, res, next) => {
  try {
    const device = await Device.findOne({ token: req.params.token });
    if (!device) return res.status(404).json({ error: 'not found' });
    res.json({ online: device.online, lastSeen: device.lastSeen, name: device.name });
  } catch (e) { next(e); }
});

// ===== QR code for device pairing =====
// Returns an HTML page with a QR code the user can scan with the phone app.
// The QR encodes a URL: simble://pair?server=<server>&token=<token>
app.get('/devices/:token/qr', async (req, res, next) => {
  try {
    const device = await Device.findOne({ token: req.params.token });
    if (!device) return res.status(404).json({ error: 'device not found' });
    const server = (req.query.server || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).toString();
    const payload = `simble://pair?server=${encodeURIComponent(server)}&token=${encodeURIComponent(device.token)}`;
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 2 });
    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pair ${device.name} — Simble</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px;text-align:center}
h1{margin:0 0 8px;font-size:24px}
.muted{color:#666;font-size:14px;margin:0 0 24px}
img{border:1px solid #eee;border-radius:8px;display:block;margin:0 auto 16px}
code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:12px;word-break:break-all}
</style></head>
<body><div class="card">
<h1>${device.name}</h1>
<p class="muted">Open Simble Gateway on the Android phone, tap "Set up", then "Scan QR code" and point at this.</p>
<img src="${qrDataUrl}" alt="QR code" />
<p class="muted">Server</p><code>${server}</code>
<p class="muted" style="margin-top:16px">Token</p><code>${device.token}</code>
</div></body></html>`);
  } catch (e) { next(e); }
});

// ===== Send SMS (from campaign-manager) =====
app.post('/messages', serverAuthMiddleware, async (req, res, next) => {
  try {
    const { deviceToken, to, message, clientId, campaignId, ignoreWindow = false } = req.body;
    if (!deviceToken || !to || !message) {
      return res.status(400).json({ error: 'deviceToken, to, message required' });
    }
    const device = await Device.findOne({ token: deviceToken });
    if (!device) return res.status(404).json({ error: 'device not found' });

    // Timezone check: don't send outside the device's configured send window
    if (!ignoreWindow) {
      const window = device.isWithinSendWindow();
      if (!window.allowed) {
        return res.status(429).json({ error: 'outside_send_window', reason: window.reason, retryable: true });
      }
    }

    // Hourly cap check
    device.resetHourlyIfNeeded();
    if (device.smsThisHour >= device.smsPerHour) {
      return res.status(429).json({ error: 'hourly_cap_reached', limit: device.smsPerHour, retryable: true });
    }

    const msg = await Message.create({
      deviceId: device._id,
      to, message, clientId, campaignId,
      status: 'queued',
    });
    res.json({ id: msg._id, status: 'queued' });
  } catch (e) { next(e); }
});

// ===== Phone-side: long-poll for next message =====
app.get('/devices/:token/poll', authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.params;
    const device = await Device.findOne({ token });
    if (!device) return res.status(401).json({ error: 'invalid token' });

    // Mark device as online
    device.online = true;
    device.lastSeen = new Date();
    await device.save();

    // Long-poll: wait up to LONG_POLL_TIMEOUT_MS for a queued message
    const deadline = Date.now() + Number(process.env.LONG_POLL_TIMEOUT_MS || 30000);
    while (Date.now() < deadline) {
      const msg = await Message.findOneAndUpdate(
        { deviceId: device._id, status: 'queued' },
        { status: 'sending' },
        { sort: { createdAt: 1 }, new: true }
      );
      if (msg) {
        return res.json({
          id: msg._id,
          to: msg.to,
          message: msg.message,
        });
      }
      // Sleep 1s and re-check
      await new Promise(r => setTimeout(r, 1000));
    }
    // Timeout: 204 No Content (phone should reconnect)
    res.status(204).end();
  } catch (e) { next(e); }
});

// ===== Phone-side: report delivery status =====
app.post('/devices/:token/messages/:id/report', authMiddleware, async (req, res, next) => {
  try {
    const { token, id } = req.params;
    const { status, error } = req.body; // 'delivered' | 'failed'
    const device = await Device.findOne({ token });
    if (!device) return res.status(401).json({ error: 'invalid token' });

    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ error: 'message not found' });
    if (String(msg.deviceId) !== String(device._id)) {
      return res.status(403).json({ error: 'message does not belong to this device' });
    }
    msg.status = status;
    msg.error = error;
    if (status === 'delivered') msg.deliveredAt = new Date();
    if (status === 'failed') msg.failedAt = new Date();
    await msg.save();

    // Increment the hourly counter on successful send
    if (status === 'delivered' || status === 'sent') {
      device.resetHourlyIfNeeded();
      device.smsThisHour += 1;
      await device.save();
    }

    res.json({ ok: true, status: msg.status });
  } catch (e) { next(e); }
});

// ===== Phone-side: heartbeat =====
app.post('/devices/:token/heartbeat', authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.params;
    const { batteryLevel, networkType } = req.body;
    const device = await Device.findOne({ token });
    if (!device) return res.status(401).json({ error: 'invalid token' });
    device.online = true;
    device.lastSeen = new Date();
    if (batteryLevel !== undefined) device.batteryLevel = batteryLevel;
    if (networkType) device.networkType = networkType;
    await device.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const PORT = Number(process.env.PORT || 4010);
const start = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  if (!process.env.SMS_RELAY_SECRET) throw new Error('SMS_RELAY_SECRET required');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('mongo: connected');
  app.listen(PORT, () => console.log(`sms-relay: listening on :${PORT}`));
};

start().catch(err => { console.error('fatal', err); process.exit(1); });
