import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Client } from '../models/Client.js';

const SECRET = process.env.JWT_SECRET;
const router = Router();

function sign(client) {
  return jwt.sign({ sub: client._id, role: client.role }, SECRET, { expiresIn: '30d' });
}

const PLAN_LIMITS = {
  starter: { smsPerMonth: 500, contactsMax: 1000 },
  growth: { smsPerMonth: 2500, contactsMax: 10000 },
  agency: { smsPerMonth: 10000, contactsMax: 100000 },
};

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, deviceId, plan = 'starter' } = req.body;
    if (!name || !email || !password || !deviceId) {
      return res.status(400).json({ error: 'name, email, password, deviceId required' });
    }
    const existing = await Client.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'email taken' });
    const passwordHash = await bcrypt.hash(password, 10);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const client = await Client.create({
      name, email: email.toLowerCase(), passwordHash, deviceId, plan, limits,
    });
    res.json({ token: sign(client), client: client.toSafeJSON() });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const client = await Client.findOne({ email: (email || '').toLowerCase() });
    if (!client) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, client.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    res.json({ token: sign(client), client: client.toSafeJSON() });
  } catch (e) { next(e); }
});

router.post('/promote-admin', async (req, res, next) => {
  // one-time bootstrap: if no admin exists, allow first signup to be admin
  try {
    const adminCount = await Client.countDocuments({ role: 'admin' });
    if (adminCount > 0) return res.status(403).json({ error: 'admin already exists' });
    const { email, password, name, deviceId } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const client = await Client.create({
      name, email: email.toLowerCase(), passwordHash, deviceId, plan: 'agency', role: 'admin',
    });
    res.json({ token: sign(client), client: client.toSafeJSON(), note: 'first admin created — endpoint now disabled' });
  } catch (e) { next(e); }
});

export { router as authRouter };
