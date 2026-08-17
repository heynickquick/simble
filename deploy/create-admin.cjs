// create-admin.cjs — create a new admin client (bypasses promote-admin check)
// Usage: node create-admin.cjs <email> <password> <name> [deviceId]
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const [, , email, password, name = 'Admin', deviceId = ''] = process.argv;
  if (!email || !password) {
    console.error('Usage: node create-admin.cjs <email> <password> <name> [deviceId]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://admin:CHANGE_ME@simble-mongodb:27017/campaigns?authSource=admin';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existing = await db.collection('clients').findOne({ email: email.toLowerCase() });
  if (existing) {
    // Update the existing account to be admin
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection('clients').updateOne(
      { _id: existing._id },
      { $set: { role: 'admin', passwordHash, name } }
    );
    console.log(`✓ Updated existing client ${email} to admin`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const PLAN_LIMITS = {
      starter: { smsPerMonth: 500, contactsMax: 1000 },
      growth: { smsPerMonth: 2500, contactsMax: 10000 },
      agency: { smsPerMonth: 10000, contactsMax: 100000 },
    };
    const doc = {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      plan: 'agency',
      deviceId,
      limits: PLAN_LIMITS.agency,
      usage: { smsThisMonth: 0, monthResetAt: new Date() },
      telegramBotToken: '',
      active: true,
      createdAt: new Date(),
    };
    await db.collection('clients').insertOne(doc);
    console.log(`✓ Created new admin ${email} (id=${doc._id})`);
  }

  // Verify
  const verify = await db.collection('clients').findOne({ email: email.toLowerCase() });
  const ok = await bcrypt.compare(password, verify.passwordHash);
  console.log(`  Sanity check: ${ok ? 'OK' : 'FAILED'}`);
  console.log(`  role: ${verify.role}`);
  console.log(`  name: ${verify.name}`);

  await mongoose.disconnect();
})();
