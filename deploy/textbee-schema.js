const r = await fetch('http://localhost:3001/-json');
const spec = await r.json();
console.log('RegisterInputDTO:');
console.log(JSON.stringify(spec.components.schemas.RegisterInputDTO, null, 2));
console.log('\nAuthSessionResponseDTO:');
console.log(JSON.stringify(spec.components.schemas.AuthSessionResponseDTO, null, 2));
