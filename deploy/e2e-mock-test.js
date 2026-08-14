// End-to-end test of Simble in MOCK mode
// Validates: login → create contact → create campaign → send → delivery report

const BASE = 'https://simble.unscale.cloud';

async function req(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok && r.status !== 401) {
    console.error(`!! ${method} ${path} → HTTP ${r.status}: ${text}`);
    throw new Error(`HTTP ${r.status}`);
  }
  return { status: r.status, data };
}

(async () => {
  console.log('1. health');
  const h = await req('GET', '/health');
  console.log('   ', h.status, JSON.stringify(h.data));

  console.log('2. login as existing admin');
  const login = await req('POST', '/api/auth/login', {
    email: 'nick@simble.example', password: 'testpass123',
  });
  console.log('   ', login.status, login.data.email || login.data.error);
  const token = login.data.token;
  if (!token) { console.log('NO TOKEN, bailing'); process.exit(1); }

  console.log('3. me');
  const me = await req('GET', '/api/clients/me', null, token);
  console.log('   ', me.status, me.data.email, me.data.plan);

  console.log('4. add a contact');
  const phone = `+1555${Math.floor(1000000 + Math.random() * 8999999)}`;
  const c = await req('POST', '/api/contacts', {
    phone, firstName: 'Mock', lastName: 'Tester',
  }, token);
  console.log('   ', c.status, c.data._id, c.data.phone);
  const contactId = c.data._id;

  console.log('5. create campaign (single message)');
  const camp = await req('POST', '/api/campaigns', {
    name: 'E2E mock test ' + Date.now(),
    message: 'Hello from Simble! This is a test SMS in MOCK mode. Reply STOP to opt out.',
    contactIds: [contactId],
    throttleMs: 500,
  }, token);
  console.log('   ', camp.status, camp.data._id, 'status=' + camp.data.status);
  const campaignId = camp.data._id;

  console.log('6. send campaign');
  const send = await req('POST', `/api/campaigns/${campaignId}/send`, null, token);
  console.log('   ', send.status, JSON.stringify(send.data));

  console.log('7. wait 5s for mock send + delivery...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('8. fetch campaign to see delivery stats');
  const after = await req('GET', `/api/campaigns/${campaignId}`, null, token);
  console.log('   ', after.status, 'status=' + after.data.status, 'stats=' + JSON.stringify(after.data.stats));
  console.log('   message:', JSON.stringify(after.data.messages[0], null, 2));
})();
