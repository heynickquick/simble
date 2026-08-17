// Probe sms-relay directly to see what routes work
const BASE = 'http://sms-relay:4010';
const SECRET = 'ff1514095ef66c292e21c4019c0c27fda204536e62c180d045fcde8455cf2760';

async function call(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  console.log(method, path, '→', r.status, t.slice(0, 200));
}

(async () => {
  await call('GET', '/health');
  await call('GET', '/devices', null, SECRET);
  await call('POST', '/devices', { name: 'Direct Test' }, SECRET);
  await call('POST', '/messages', { deviceToken: 'fake', to: '+15551234567', message: 'test' }, SECRET);
  await call('GET', '/devices/fake/poll');
})();
