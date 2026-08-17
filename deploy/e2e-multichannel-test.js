// e2e-multichannel-test.js
// End-to-end test for the multi-channel + throttling stack.
//
// What it validates:
//   1. Login + auth round-trip
//   2. CSV import now includes chatId
//   3. SMS campaign via sms-relay (mock mode) — sent + delivered via webhook
//   4. Telegram campaign — wiring is correct, send fails gracefully without a bot token
//   5. Timezone throttling at the relay: device in Europe/London right now = outside 9-21
//      window → POST /messages returns 429 outside_send_window with retryable=true
//   6. Hourly cap: device with smsPerHour=2, the 3rd send returns 429 hourly_cap_reached
//
// Run from local:  node deploy/e2e-multichannel-test.js
// Requires the campaign-manager and sms-relay to be reachable. The script reads
// CM_BASE and RELAY_BASE from env (default https://simble.unscale.cloud and
// http://72.60.63.202:4010).

const http = require('http');
const https = require('https');
const { URL } = require('url');

const CM_BASE   = process.env.CM_BASE   || 'https://simble.unscale.cloud';
const RELAY_BASE = process.env.RELAY_BASE || 'http://72.60.63.202:4010';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nick@simble.example';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'testpass123';
const RELAY_SECRET = process.env.RELAY_SECRET || 'ff1514095ef66c292e21c4019c0c27fda204536e62c180d045fcde8455cf2760';

let pass = 0, fail = 0;
const results = [];

function logResult(name, ok, detail) {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${name}${detail ? ' — ' + detail : ''}`);
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
}

function request(base, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + path);
    const lib = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
      timeout: 15_000,
    };
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function pollUntil(fn, { timeout = 15_000, interval = 1000, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(interval);
  }
  throw new Error(`pollUntil timed out: ${label}`);
}

async function main() {
  console.log(`\nSimble e2e — CM=${CM_BASE}  RELAY=${RELAY_BASE}\n`);

  // ===== 1. login =====
  let r = await request(CM_BASE, '/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  if (r.status !== 200) {
    logResult('login', false, `status=${r.status} body=${JSON.stringify(r.body)}`);
    return finish();
  }
  const token = r.body.token;
  const clientId = r.body.client._id;
  logResult('login', true, `clientId=${clientId}`);

  const auth = { Authorization: `Bearer ${token}` };

  // ===== 2. CSV import with chatId =====
  const csv = [
    'phone,firstName,lastName,chatId',
    '+15551234567,SMS-One,Test,',
    '+15551234568,SMS-Two,Test,',
    '+15551234569,TG-One,Test,123456789',
  ].join('\n');
  r = await request(CM_BASE, '/api/contacts/bulk', { method: 'POST', headers: auth, body: { csv } });
  // On first run: all 3 upserts. On subsequent runs: same data → 0 upserts, 0
  // updates, but the import still succeeded (no records skipped). Verify success
  // by checking total records processed.
  const csvOk = r.status === 200 && r.body.total === 3 && r.body.skipped === 0;
  logResult('csv import (with chatId)', csvOk, JSON.stringify(r.body));

  // ===== 2b. Create a fresh device for the SMS test, in a sensible timezone
  // (America/Asuncion). Point the admin client's deviceId at it so the SMS
  // campaign doesn't hit the relay's timezone check. We clear the deviceId at
  // the end so the admin can reassign in the UI.
  let smsDeviceToken = null;
  const r2 = await request(RELAY_BASE, '/devices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RELAY_SECRET}` },
    body: { name: `e2e-sms-device-${Date.now()}`, phoneNumber: '' },
  });
  if (r2.status !== 200) {
    logResult('relay: create sms device', false, JSON.stringify(r2.body));
  } else {
    smsDeviceToken = r2.body.token;
    await request(RELAY_BASE, `/devices/${r2.body.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { timezone: 'America/Asuncion', smsPerHour: 100 },
    });
    // Tell the campaign-manager to use this device for sends
    await request(CM_BASE, '/api/clients/me', { method: 'PATCH', headers: auth, body: { deviceId: smsDeviceToken } });
    logResult('relay: create sms device + bind to client', true, `token=${smsDeviceToken.slice(0, 16)}...`);
  }

  // ===== 3. create SMS campaign (mock mode) =====
  // Note: '+' must be URL-encoded as %2B; otherwise Express decodes it as space.
  const smsContacts = await request(CM_BASE, '/api/contacts?q=%2B1555123456', { headers: auth });
  const smsIds = smsContacts.body.contacts.filter(c => c.phone.startsWith('+15551234567') || c.phone.startsWith('+15551234568')).map(c => c._id);
  if (smsIds.length < 2) {
    logResult('sms campaign: pick contacts', false, `found ${smsIds.length} (response had ${smsContacts.body?.contacts?.length} contacts)`);
  } else {
    let cr = await request(CM_BASE, '/api/campaigns', {
      method: 'POST', headers: auth,
      body: { name: 'e2e-sms', message: 'hello from e2e', contactIds: smsIds, channel: 'sms', throttleMs: 200 },
    });
    if (cr.status !== 200) {
      logResult('sms campaign: create', false, JSON.stringify(cr.body));
    } else {
      const cId = cr.body._id;
      logResult('sms campaign: create', true, `id=${cId}`);
      r = await request(CM_BASE, `/api/campaigns/${cId}/send`, { method: 'POST', headers: auth });
      logResult('sms campaign: send', r.status === 200, `status=${r.status}`);

      // wait for messages to reach 'sent' (relay accepted) or 'delivered' (mock webhook).
      // In sms-relay mode with no real phone, sent=2 happens immediately; delivered
      // requires a phone to pick it up (won't happen in CI). In mock mode, the
      // webhook fires after ~3s and delivered=2.
      const final = await pollUntil(async () => {
        const c = await request(CM_BASE, `/api/campaigns/${cId}`, { headers: auth });
        const completed = (c.body?.stats?.sent || 0) + (c.body?.stats?.delivered || 0);
        if (completed >= smsIds.length) return c.body;
        return null;
      }, { timeout: 15_000, label: 'sms sent or delivered' }).catch(e => ({ error: e.message }));
      if (final?.error) {
        logResult('sms campaign: sent (relay accepted)', false, final.error);
      } else {
        const sent = final.stats.sent || 0;
        const delivered = final.stats.delivered || 0;
        logResult('sms campaign: sent (relay accepted)', sent + delivered >= smsIds.length, `sent=${sent} delivered=${delivered}/${smsIds.length}`);
      }
    }
  }

  // ===== 4. create Telegram campaign (no bot token → expect graceful failure) =====
  const tgContacts = await request(CM_BASE, '/api/contacts?q=%2B15551234569', { headers: auth });
  const tgIds = tgContacts.body.contacts.filter(c => c.chatId).map(c => c._id);
  if (tgIds.length < 1) {
    logResult('telegram campaign: find contact with chatId', false, 'no contact with chatId');
  } else {
    let cr = await request(CM_BASE, '/api/campaigns', {
      method: 'POST', headers: auth,
      body: { name: 'e2e-tg', message: 'hello telegram', contactIds: tgIds, channel: 'telegram', throttleMs: 200 },
    });
    if (cr.status !== 200) {
      logResult('telegram campaign: create', false, JSON.stringify(cr.body));
    } else {
      const cId = cr.body._id;
      logResult('telegram campaign: create', true, `id=${cId} channel=${cr.body.channel}`);
      r = await request(CM_BASE, `/api/campaigns/${cId}/send`, { method: 'POST', headers: auth });
      logResult('telegram campaign: send (no token)', r.status === 200, `status=${r.status}`);
      // Wait for messages to move out of 'queued' (either sent or failed)
      const final = await pollUntil(async () => {
        const c = await request(CM_BASE, `/api/campaigns/${cId}`, { headers: auth });
        if (c.body?.stats?.sent + c.body?.stats?.failed >= tgIds.length) return c.body;
        return null;
      }, { timeout: 15_000, label: 'tg campaign done' }).catch(e => ({ error: e.message }));
      if (final?.error) {
        logResult('telegram campaign: finished', false, final.error);
      } else {
        // Without a real bot token, expect all messages failed (Telegram API rejects fake token)
        const allFailed = final.stats.failed === tgIds.length;
        const msg0 = final.messages?.[0];
        const errLooksRight = msg0?.error?.toLowerCase().includes('telegram') || msg0?.error?.toLowerCase().includes('401') || msg0?.error?.toLowerCase().includes('bot');
        logResult('telegram campaign: no-token path fails gracefully',
          allFailed && errLooksRight,
          `failed=${final.stats.failed}/${tgIds.length} err="${msg0?.error || ''}"`);
      }
    }
  }

  // ===== 5. direct sms-relay: timezone throttling =====
  // Create a new device
  r = await request(RELAY_BASE, '/devices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RELAY_SECRET}` },
    body: { name: `e2e-tz-test-${Date.now()}`, phoneNumber: '+15550000000' },
  });
  if (r.status !== 200) {
    logResult('relay: create device', false, JSON.stringify(r.body));
  } else {
    const dev = r.body;
    logResult('relay: create device', true, `id=${dev.id} token=${dev.token.slice(0, 16)}...`);
    // Set timezone to Europe/London — current GMT is 22:xx so outside 9-21
    r = await request(RELAY_BASE, `/devices/${dev.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { timezone: 'Europe/London', smsPerHour: 100 },
    });
    logResult('relay: PATCH timezone=Europe/London', r.status === 200 && r.body.timezone === 'Europe/London', `tz=${r.body?.timezone}`);
    // Try to send — expect 429 outside_send_window
    r = await request(RELAY_BASE, '/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { deviceToken: dev.token, to: '+15551234567', message: 'tz test' },
    });
    const tzOk = r.status === 429 && r.body?.error === 'outside_send_window' && r.body?.retryable === true;
    logResult('relay: outside_send_window 429', tzOk, `status=${r.status} error=${r.body?.error} retryable=${r.body?.retryable}`);
    if (r.body?.reason) console.log(`         reason: ${r.body.reason}`);

    // Reset to Asuncion, cap to 2
    r = await request(RELAY_BASE, `/devices/${dev.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { timezone: 'America/Asuncion', smsPerHour: 2 },
    });
    logResult('relay: PATCH timezone=America/Asuncion, smsPerHour=2', r.status === 200 && r.body.smsPerHour === 2, `tz=${r.body?.timezone} cap=${r.body?.smsPerHour}`);

    // Send 2 — should both succeed
    const sends = [];
    for (let i = 0; i < 2; i++) {
      sends.push(request(RELAY_BASE, '/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RELAY_SECRET}` },
        body: { deviceToken: dev.token, to: '+15551234567', message: `cap test ${i}` },
      }));
    }
    const results = await Promise.all(sends);
    const allSucceeded = results.every(x => x.status === 200);
    logResult('relay: 2 sends within cap', allSucceeded, `statuses=${results.map(x => x.status).join(',')}`);

    // 3rd send — expect 429 hourly_cap_reached
    r = await request(RELAY_BASE, '/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { deviceToken: dev.token, to: '+15551234567', message: 'cap test 3' },
    });
    const capOk = r.status === 429 && r.body?.error === 'hourly_cap_reached' && r.body?.retryable === true;
    logResult('relay: hourly_cap_reached 429', capOk, `status=${r.status} error=${r.body?.error} retryable=${r.body?.retryable}`);
    if (r.body?.limit !== undefined) console.log(`         limit=${r.body.limit}`);

    // Cleanup: reset cap so the test device doesn't stay pinned at 2
    await request(RELAY_BASE, `/devices/${dev.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${RELAY_SECRET}` },
      body: { smsPerHour: 100, smsThisHour: 0 },
    });
  }

  // Cleanup: restore the admin's deviceId if we changed it
  if (smsDeviceToken) {
    // Best-effort: set back to empty (admin can reassign in the UI).
    // We don't have the original — it was a stale "Direct Test" sim_* token.
    await request(CM_BASE, '/api/clients/me', { method: 'PATCH', headers: auth, body: { deviceId: '' } });
  }

  finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('\nResults:');
  for (const r of results) {
    const mark = r.ok ? '✅' : '❌';
    console.log(`  ${mark} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('fatal:', e);
  process.exit(1);
});
