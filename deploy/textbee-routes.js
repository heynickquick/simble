// Probe root-level routes (no /api prefix)
const paths = [
  '/',
  '/health',
  '/-json',
  '/auth/signup',
  '/auth/login',
  '/users/signup',
  '/users/login',
  '/gateway/messages',
  '/gateway/devices',
  '/v1/gateway/messages',
  '/v1/auth/signup',
];
for (const p of paths) {
  try {
    const r = await fetch('http://localhost:3001' + p, { method: p.includes('signup') || p.includes('messages') || p.includes('devices') ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' } });
    const t = await r.text();
    console.log(r.status, p, '→', t.slice(0, 80).replace(/\n/g, ' '));
  } catch (e) {
    console.log('ERR', p, '→', e.message);
  }
}
