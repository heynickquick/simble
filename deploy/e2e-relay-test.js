// e2e test for sms-relay mode (no textbee, no FCM)
// Validates: register a device on sms-relay, queue an SMS, simulate a phone
// agent picking it up and reporting back, check that campaign-manager sees
// the delivery webhook.

const RELAY_SECRET = 'ff1514095ef66c292e21c4019c0c27fda204536e62c180d045fcde8455cf2760';
const SIMBLE = 'https://simble.unscale.cloud';
const RELAY = 'https://simble.unscale.cloud'; // routed through same nginx

async function call(method, url, body, token) {
  const r = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

(async () => {
  console.log('1. login to campaign-manager as admin');
  const login = await call('POST', SIMBLE + '/api/auth/login', {
    email: 'nick@simble.example', password: 'testpass123',
  });
  console.log('   ', login.status, login.data?.email || login.data?.error);
  const cmToken = login.data?.token;
  if (!cmToken) { console.log('NO TOKEN, bailing'); process.exit(1); }

  console.log('2. register a device on sms-relay');
  const reg = await call('POST', RELAY + '/devices', { name: 'Test E2E Device' }, RELAY_SECRET);
  console.log('   ', reg.status, 'id=' + reg.data.id, 'token=' + reg.data.token.slice(0, 14) + '...');
  const deviceToken = reg.data.token;
  const deviceId = reg.data.id;

  console.log('3. enqueue an SMS via campaign-manager');
  const contact = await call('POST', SIMBLE + '/api/contacts', {
    phone: '+1555' + Math.floor(1000000 + Math.random() * 8999999),
    firstName: 'E2E', lastName: 'Test',
  }, cmToken);
  console.log('   contact:', contact.status, contact.data._id);

  const camp = await call('POST', SIMBLE + '/api/campaigns', {
    name: 'sms-relay e2e ' + Date.now(),
    message: 'Hello from Simble via sms-relay!',
    contactIds: [contact.data._id],
    throttleMs: 500,
  }, cmToken);
  console.log('   campaign:', camp.status, camp.data._id);
  const campaignId = camp.data._id;

  console.log('4. send the campaign');
  const send = await call('POST', SIMBLE + `/api/campaigns/${campaignId}/send`, null, cmToken);
  console.log('   ', send.status, JSON.stringify(send.data));

  console.log('5. wait 2s for the queue');
  await new Promise(r => setTimeout(r, 2000));

  console.log('6. simulate phone agent: long-poll for messages');
  const poll = await fetch(`${RELAY}/devices/${deviceToken}/poll`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (poll.status === 204) {
    console.log('   no message in queue (unexpected — send should have queued one)');
  } else {
    const msg = await poll.json();
    console.log('   got message:', msg);

    console.log('7. simulate phone: report delivery');
    const report = await call('POST',
      `${RELAY}/devices/${deviceToken}/messages/${msg.id}/report`,
      { status: 'delivered' },
    );
    console.log('   ', report.status, JSON.stringify(report.data));
  }

  console.log('8. wait 3s for campaign-manager to process webhook');
  await new Promise(r => setTimeout(r, 3000));

  console.log('9. fetch campaign status');
  const after = await call('GET', SIMBLE + `/api/campaigns/${campaignId}`, null, cmToken);
  console.log('   status:', after.data?.status, 'stats:', JSON.stringify(after.data?.stats));
  console.log('   message[0]:', JSON.stringify(after.data?.messages?.[0], null, 2));
})();
