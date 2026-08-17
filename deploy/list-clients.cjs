// list-clients.js — list all clients in the campaigns database
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:CHANGE_ME@simble-mongodb:27017/campaigns?authSource=admin';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const clients = await db.collection('clients').find({}).project({ email: 1, role: 1, name: 1, createdAt: 1, deviceId: 1 }).toArray();
  console.log('Total clients:', clients.length);
  for (const c of clients) {
    console.log(`  ${c.email}  role=${c.role}  name="${c.name}"  deviceId="${c.deviceId || ''}"  created=${c.createdAt?.toISOString?.() || c.createdAt}`);
  }
  await mongoose.disconnect();
})();
