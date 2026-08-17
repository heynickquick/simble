// list-devices.js — fetch and print first 3 device IDs
const http = require('http');
const SECRET = 'ff1514095ef66c292e21c4019c0c27fda204536e62c180d045fcde8455cf2760';
http.get({
  host: '127.0.0.1', port: 4010, path: '/devices',
  headers: { Authorization: `Bearer ${SECRET}` },
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const a = JSON.parse(d);
    console.log(`Total devices: ${a.length}`);
    a.slice(0, 3).forEach(x => console.log(`  ${x.id}  ${x.name}  online=${x.online}`));
  });
});
