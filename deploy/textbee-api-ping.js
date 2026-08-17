const r = await fetch('http://localhost:3000/api/gateway/devices', {
  headers: { 'Content-Type': 'application/json' },
});
const t = await r.text();
console.log('status:', r.status);
console.log('body:', t.slice(0, 500));
