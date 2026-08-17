// Watchdog: monitors sms-relay device health, alerts via Telegram on outages.
//
// Required env:
//   SMS_RELAY_URL    e.g. http://sms-relay:4010 (in-container) or http://72.60.63.202:4010 (host)
//   SMS_RELAY_SECRET bearer token shared with sms-relay (SMS_RELAY_SECRET)
//   DEVICE_IDS       comma-separated list of sms-relay device _ids (Mongo ObjectId) to monitor
//   TELEGRAM_BOT_TOKEN optional, for alerts
//   TELEGRAM_CHAT_ID   optional, target chat
//
// Optional env:
//   POLL_INTERVAL_MS   default 60000
//   OFFLINE_THRESHOLD_MS  default 300000 (5 min)
//   ALERT_COOLDOWN_MS  default 1800000 (30 min) — re-alert window per device
//   ONE_OFFLINE_REPEAT_MS  default 0 (set >0 to re-alert every N ms while still offline)
//
// To get device IDs, list them: curl -H "Authorization: Bearer $SMS_RELAY_SECRET" $SMS_RELAY_URL/devices

import axios from 'axios';
import 'dotenv/config';

const RELAY  = process.env.SMS_RELAY_URL;
const SECRET = process.env.SMS_RELAY_SECRET;
const DEVICES = (process.env.DEVICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const TG_BOT = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const POLL = Number(process.env.POLL_INTERVAL_MS || 60_000);
const OFFLINE_THRESHOLD = Number(process.env.OFFLINE_THRESHOLD_MS || 5 * 60_000);
const COOLDOWN = Number(process.env.ALERT_COOLDOWN_MS || 30 * 60_000);

if (!RELAY || !SECRET || !DEVICES.length) {
  console.error('SMS_RELAY_URL, SMS_RELAY_SECRET, DEVICE_IDS are required');
  process.exit(1);
}

const http = axios.create({
  baseURL: RELAY,
  headers: { 'Authorization': `Bearer ${SECRET}` },
  timeout: 15_000,
});

const state = new Map();
for (const id of DEVICES) {
  state.set(id, { lastSeen: null, lastAlertedAt: 0, lastOnline: false, name: id });
}

async function sendTelegram(text) {
  if (!TG_BOT || !TG_CHAT) {
    console.log('[telegram disabled]', text.replace(/<[^>]+>/g, ''));
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      chat_id: TG_CHAT,
      text,
      parse_mode: 'HTML',
    }, { timeout: 10_000 });
  } catch (e) {
    console.error('[telegram send failed]', e.message);
  }
}

async function fetchDevices() {
  // sms-relay returns the full list with safe JSON. Pick name + id for the IDs we monitor.
  const { data } = await http.get('/devices');
  const byId = new Map(data.map(d => [String(d.id), d]));
  return DEVICES.map(id => byId.get(String(id))).filter(Boolean);
}

async function checkDevice(deviceId) {
  try {
    // sms-relay exposes /devices/:token/status. We use the _id by looking it up
    // in /devices, but the simplest is to call /devices (already does that) and
    // pick the entry.
    const { data } = await http.get('/devices');
    const d = data.find(x => String(x.id) === String(deviceId));
    if (!d) return { online: false, lastSeen: null, error: 'device not found' };
    return {
      online: !!d.online,
      lastSeen: d.lastSeen ? new Date(d.lastSeen).getTime() : null,
      name: d.name,
    };
  } catch (e) {
    return { online: false, lastSeen: null, error: e.message };
  }
}

async function tick() {
  for (const id of DEVICES) {
    const s = state.get(id);
    const result = await checkDevice(id);
    const now = Date.now();

    if (result.online) {
      if (!s.lastOnline) {
        await sendTelegram(`✅ <b>Simble device online</b>\nDevice <code>${s.name}</code> (${id}) is back.\nLast seen: ${result.lastSeen ? new Date(result.lastSeen).toISOString() : 'unknown'}`);
        s.lastAlertedAt = 0;
      }
      s.lastSeen = result.lastSeen || now;
      s.lastOnline = true;
    } else {
      const sinceLastSeen = s.lastSeen ? now - s.lastSeen : 0;
      const offline = !s.lastSeen || sinceLastSeen > OFFLINE_THRESHOLD;
      s.lastOnline = false;

      if (offline && now - s.lastAlertedAt > COOLDOWN) {
        await sendTelegram(`🚨 <b>Simble device offline</b>\nDevice <code>${s.name}</code> (${id}) has been unreachable for ${Math.round(sinceLastSeen / 60_000)} min.\nLast seen: ${s.lastSeen ? new Date(s.lastSeen).toISOString() : 'never'}\nError: ${result.error || 'no heartbeat'}`);
        s.lastAlertedAt = now;
      }
    }
    console.log(`[${new Date().toISOString()}] device ${s.name} (${id}): online=${result.online}${s.lastSeen ? ` lastSeen=${new Date(s.lastSeen).toISOString()}` : ''}`);
  }
}

async function main() {
  console.log(`watchdog: monitoring ${DEVICES.length} device(s): ${DEVICES.join(', ')}`);
  console.log(`watchdog: relay=${RELAY}, poll every ${POLL}ms, alert threshold ${OFFLINE_THRESHOLD}ms`);
  if (TG_BOT && TG_CHAT) {
    await sendTelegram(`🐶 <b>Simble watchdog started</b>\nMonitoring ${DEVICES.length} device(s).`);
  }
  await tick();
  setInterval(tick, POLL);
}

main().catch(err => {
  console.error('fatal', err);
  process.exit(1);
});
