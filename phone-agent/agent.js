// Simble phone agent — runs in Termux on the friend's Android phone.
// Polls sms-relay for SMS commands, sends via Termux:API, reports back.
//
// Setup (one time, on the phone):
//   1. Install Termux from F-Droid (NOT Play Store — Play Store version is outdated)
//   2. Open Termux, run:
//        pkg update && pkg install nodejs termux-api
//   3. Grant Termux:API the SMS permission:
//        termux-setup-storage  (grants file access)
//        Allow SMS in Android Settings → Apps → Termux:API → Permissions
//   4. Clone this repo or copy agent.js + package.json to the phone, then:
//        npm install
//        RELAY_URL=https://sms.simble.unscale.cloud DEVICE_TOKEN=sim_xxx node agent.js
//   5. (Optional) Auto-start: see README for Termux:Boot setup

import axios from 'axios';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileP = promisify(execFile);

const RELAY = process.env.RELAY_URL || 'https://sms.simble.unscale.cloud';
const TOKEN = process.env.DEVICE_TOKEN;
const POLL_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 60000;
const STATE_FILE = process.env.STATE_FILE || path.join(process.env.HOME || '/data/data/com.termux/files/home', '.simble-agent.json');

if (!TOKEN) {
  console.error('DEVICE_TOKEN is required');
  console.error('Set it to the value returned when you registered the device:');
  console.error('  curl -X POST -H "Authorization: Bearer YOUR_SECRET" \\');
  console.error('    https://sms.simble.unscale.cloud/devices -d \'{"name":"My Phone"}\'');
  process.exit(1);
}

console.log(`[simble-agent] starting, relay=${RELAY}`);
console.log(`[simble-agent] token=${TOKEN.slice(0, 12)}...`);

// Load persisted state (battery baseline, etc.)
let state = {};
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch {}

async function sendSms(to, message) {
  // Use Termux:API to send SMS. Requires the termux-api package + SMS permission.
  try {
    const { stdout } = await execFileP('termux-sms-send', ['-n', to, message]);
    return { ok: true, output: stdout };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getBatteryLevel() {
  try {
    const { stdout } = await execFileP('termux-battery-status', []);
    const j = JSON.parse(stdout);
    return j.percentage;
  } catch {
    return null;
  }
}

async function getNetworkType() {
  try {
    const { stdout } = await execFileP('termux-telephony-deviceinfo', []);
    const j = JSON.parse(stdout);
    return j.network_type || '';
  } catch {
    return '';
  }
}

async function reportDelivery(messageId, status, error) {
  try {
    await axios.post(
      `${RELAY}/devices/${TOKEN}/messages/${messageId}/report`,
      { status, error },
      { timeout: 10_000 }
    );
  } catch (e) {
    console.error(`[report] failed for ${messageId}: ${e.message}`);
  }
}

async function sendHeartbeat() {
  try {
    const batteryLevel = await getBatteryLevel();
    const networkType = await getNetworkType();
    await axios.post(
      `${RELAY}/devices/${TOKEN}/heartbeat`,
      { batteryLevel, networkType },
      { timeout: 10_000 }
    );
  } catch (e) {
    console.error(`[heartbeat] failed: ${e.message}`);
  }
}

async function poll() {
  while (true) {
    try {
      const r = await axios.get(`${RELAY}/devices/${TOKEN}/poll`, {
        timeout: 35_000, // server long-poll is 30s, give a bit of margin
      });
      if (r.status === 204) continue; // no message, keep polling
      const msg = r.data;
      if (!msg || !msg.id) continue;
      console.log(`[poll] got message ${msg.id} → ${msg.to}`);
      const result = await sendSms(msg.to, msg.message);
      if (result.ok) {
        console.log(`[poll] sent ${msg.id} OK`);
        await reportDelivery(msg.id, 'delivered');
      } else {
        console.error(`[poll] send failed: ${result.error}`);
        await reportDelivery(msg.id, 'failed', result.error);
      }
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
        // Long-poll timeout, that's fine
        continue;
      }
      console.error(`[poll] error: ${e.message}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

(async () => {
  // Initial heartbeat
  await sendHeartbeat();
  // Periodic heartbeats
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  // Save state on exit
  process.on('SIGINT', () => {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ token: TOKEN, lastExit: 'SIGINT', at: new Date().toISOString() }, null, 2));
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ token: TOKEN, lastExit: 'SIGTERM', at: new Date().toISOString() }, null, 2));
    process.exit(0);
  });
  // Start polling
  await poll();
})();
