// Smoke test for simble campaign-manager
// Runs inside the campaign-manager container
const base = 'http://localhost:4000';

async function req(method, path, body, token) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

(async () => {
  console.log('1. health');
  console.log(await req('GET', '/health'));

  console.log('2. promote admin (first call)');
  const admin = await req('POST', '/api/auth/promote-admin', {
    name: 'Nick', email: 'nick@simble.example', password: 'testpass123', deviceId: 'PLACEHOLDER',
  });
  console.log(admin);
  const token = admin.data?.token;

  if (!token) { console.log('NO TOKEN, bailing'); process.exit(1); }

  console.log('3. login');
  console.log(await req('POST', '/api/auth/login', { email: 'nick@simble.example', password: 'testpass123' }));

  console.log('4. me');
  console.log(await req('GET', '/api/clients/me', null, token));

  console.log('5. signup new client');
  const su = await req('POST', '/api/auth/signup', {
    name: 'Acme Corp', email: `client-${Date.now()}@acme.example`, password: 'clientpw', deviceId: 'PLACEHOLDER',
  });
  console.log(su);
  const clientToken = su.data?.token;

  console.log('6. add contact (as client)');
  const c = await req('POST', '/api/contacts', {
    phone: '+15551234567', firstName: 'Alice', lastName: 'Test',
  }, clientToken);
  console.log(c);

  console.log('7. list contacts');
  console.log(await req('GET', '/api/contacts', null, clientToken));

  console.log('8. create campaign');
  const camp = await req('POST', '/api/campaigns', {
    name: 'Test blast', message: 'Hello from Simble!', contactIds: [c.data._id], throttleMs: 2000,
  }, clientToken);
  console.log(camp);
})();
