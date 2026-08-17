// test-login.cjs — verify a login works against the live API
const https = require('https');

const email = process.argv[2] || 'nick@simble.example';
const password = process.argv[3] || 'simble2026';

const data = JSON.stringify({ email, password });
const req = https.request({
  hostname: 'simble.unscale.cloud',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  let s = '';
  res.on('data', c => s += c);
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    try {
      const j = JSON.parse(s);
      if (j.token) {
        console.log('  email:', j.client?.email);
        console.log('  role:', j.client?.role);
        console.log('  name:', j.client?.name);
        console.log('  token length:', j.token?.length);
        console.log('  ✓ Login works');
      } else {
        console.log('  body:', s);
      }
    } catch (e) {
      console.log('  body:', s);
    }
  });
});
req.on('error', e => console.error('error:', e.message));
req.write(data);
req.end();
