const r = await fetch('http://localhost:3001/-json');
const spec = await r.json();
const paths = Object.keys(spec.paths || {});
console.log('Total paths:', paths.length);
console.log('All paths:');
for (const p of paths) {
  const methods = Object.keys(spec.paths[p] || {}).filter(m => ['get', 'post', 'put', 'delete', 'patch'].includes(m));
  console.log(' ', methods.map(m => m.toUpperCase()).join(','), p);
}
