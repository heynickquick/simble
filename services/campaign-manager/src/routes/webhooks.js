import { Router } from 'express';
import { Campaign } from '../models/Campaign.js';

const router = Router();

// textbee delivery report webhook
// Expected body: { id: messageId, status: 'delivered'|'failed', phone }
// NOTE: textbee currently does NOT sign these webhooks — TODO add signature check when feature lands
router.post('/textbee', async (req, res, next) => {
  try {
    const { id, messageId, status, phone } = req.body;
    const extId = id || messageId;
    if (!extId) return res.status(400).json({ error: 'id required' });

    const campaign = await Campaign.findOne({ 'messages.externalId': extId });
    if (!campaign) return res.status(404).json({ ok: true, note: 'unknown message id' });

    const m = campaign.messages.find(x => x.externalId === extId);
    if (!m) return res.status(404).json({ error: 'message not in campaign' });

    if (status === 'delivered') {
      if (m.status === 'sent') {
        m.status = 'delivered';
        m.deliveredAt = new Date();
        campaign.stats.delivered += 1;
      }
    } else if (status === 'failed') {
      if (m.status !== 'failed') {
        // adjust stats: move from current state
        if (m.status === 'delivered') campaign.stats.delivered -= 1;
        else if (m.status === 'sent') campaign.stats.sent -= 1;
        else if (m.status === 'queued') campaign.stats.queued -= 1;
        m.status = 'failed';
        m.error = 'delivery failed (reported)';
        campaign.stats.failed += 1;
      }
    }
    await campaign.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export { router as webhookRouter };
