import { Router } from 'express';
import { Campaign } from '../models/Campaign.js';
import { Contact } from '../models/Contact.js';
import { runCampaign } from '../services/scheduler.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const campaigns = await Campaign.find({ clientId: req.client._id })
      .select('-messages')
      .sort('-createdAt')
      .limit(100);
    res.json(campaigns);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, message, contactIds, scheduledAt, throttleMs = 2000, channel = 'sms' } = req.body;
    if (!name || !message || !Array.isArray(contactIds) || !contactIds.length) {
      return res.status(400).json({ error: 'name, message, contactIds required' });
    }
    // Confirm contacts belong to this client
    const owned = await Contact.find({ _id: { $in: contactIds }, clientId: req.client._id }).select('_id phone');
    if (owned.length !== contactIds.length) {
      return res.status(400).json({ error: 'some contactIds are invalid' });
    }
    const campaign = await Campaign.create({
      clientId: req.client._id,
      name, message, channel, scheduledAt, throttleMs,
      status: scheduledAt ? 'scheduled' : 'draft',
      stats: { total: owned.length, queued: owned.length },
      messages: owned.map(c => ({ contactId: c._id, phone: c.phone, status: 'queued' })),
    });
    res.json(campaign);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const c = await Campaign.findOne({ _id: req.params.id, clientId: req.client._id });
    if (!c) return res.status(404).json({ error: 'not found' });
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/:id/send', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, clientId: req.client._id });
    if (!campaign) return res.status(404).json({ error: 'not found' });
    if (['sending', 'sent'].includes(campaign.status)) {
      return res.status(409).json({ error: `cannot send, status is ${campaign.status}` });
    }

    // Quota check
    req.client.resetUsageIfNeeded();
    if (req.client.usage.smsThisMonth + campaign.stats.queued > req.client.limits.smsPerMonth) {
      return res.status(402).json({
        error: 'quota exceeded',
        need: campaign.stats.queued,
        remaining: req.client.limits.smsPerMonth - req.client.usage.smsThisMonth,
      });
    }

    // Fire async — don't block
    runCampaign(campaign, req.client).catch(err => {
      console.error('[runCampaign]', err);
    });

    res.json({ ok: true, status: 'sending' });
  } catch (e) { next(e); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const c = await Campaign.findOne({ _id: req.params.id, clientId: req.client._id });
    if (!c) return res.status(404).json({ error: 'not found' });
    if (c.status !== 'sending') return res.status(409).json({ error: `cannot cancel, status is ${c.status}` });
    c.status = 'cancelled';
    c.finishedAt = new Date();
    await c.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export { router as campaignRouter };
