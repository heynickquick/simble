const r = await fetch('http://localhost:3001/-json');
const spec = await r.json();
const reg = spec.paths['/api/v1/auth/register'].post;
console.log('register endpoint:');
console.log(JSON.stringify(reg, null, 2).slice(0, 2000));
