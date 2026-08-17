// probe-login.cjs — try logging in as a browser would (with same headers)
const https = require('https');

const email = process.argv[2] || 'nickquick@pm.me';
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
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://simble.unscale.cloud',
    'Referer': 'https://simble.unscale.cloud/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
}, (res) => {
  let s = '';
  res.on('data', c => s += c);
  res.on('end', () => {
    console.log(`HTTP ${res.statusCode}`);
    console.log(`Headers:`);
    for (const [k, v] of Object.entries(res.headers)) console.log(`  ${k}: ${v}`);
    console.log(`Body: ${s}`);
  });
});
req.on('error', e => console.error('error:', e.message));
req.write(data);
req.end();
