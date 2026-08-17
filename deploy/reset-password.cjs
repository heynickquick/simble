// reset-password.js — reset a client's password by email
// Usage: node reset-password.cjs <email> <new-password>
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error('Usage: node reset-password.cjs <email> <newPassword>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://admin:CHANGE_ME@simble-mongodb:27017/campaigns?authSource=admin';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const client = await db.collection('clients').findOne({ email: email.toLowerCase() });
  if (!client) {
    console.error(`No client found with email ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.collection('clients').updateOne({ _id: client._id }, { $set: { passwordHash } });
  console.log(`✓ Password reset for ${email} (id=${client._id})`);
  console.log(`  New password: ${newPassword}`);

  // Sanity-check: try to login via the new hash
  const ok = await bcrypt.compare(newPassword, passwordHash);
  console.log(`  Sanity check: ${ok ? 'OK' : 'FAILED'}`);

  await mongoose.disconnect();
})();
