import { Router } from 'express';
import { Client } from '../models/Client.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/me', async (req, res) => {
  res.json(req.client.toSafeJSON());
});

router.patch('/me', async (req, res, next) => {
  try {
    const { name, deviceId } = req.body;
    if (name) req.client.name = name;
    if (deviceId && req.client.role === 'admin') {
      // clients can't change their own device; admin can
      req.client.deviceId = deviceId;
    }
    await req.client.save();
    res.json({ ok: true, client: req.client.toSafeJSON() });
  } catch (e) { next(e); }
});

// admin-only
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const clients = await Client.find().select('-passwordHash').sort('-createdAt');
    res.json(clients);
  } catch (e) { next(e); }
});

router.patch('/:id', adminOnly, async (req, res, next) => {
  try {
    const { plan, deviceId, active, limits } = req.body;
    const c = await Client.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not found' });
    if (plan) c.plan = plan;
    if (deviceId) c.deviceId = deviceId;
    if (typeof active === 'boolean') c.active = active;
    if (limits) c.limits = { ...c.limits.toObject(), ...limits };
    await c.save();
    res.json(c.toSafeJSON());
  } catch (e) { next(e); }
});

export { router as clientRouter };
