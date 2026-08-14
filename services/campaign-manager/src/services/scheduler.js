import { Campaign } from '../models/Campaign.js';
import { sendSms } from './textbee.js';

/**
 * Run a campaign end-to-end. Updates the campaign doc as it goes.
 * Throttles per `campaign.throttleMs` to be friendly to consumer SIMs.
 */
export async function runCampaign(campaign, client) {
  campaign.status = 'sending';
  campaign.startedAt = new Date();
  await campaign.save();

  console.log(`[campaign ${campaign._id}] starting, ${campaign.stats.queued} queued`);

  for (const m of campaign.messages) {
    if (m.status !== 'queued') continue;
    if (campaign.status === 'cancelled') break;

    m.status = 'sending';
    campaign.stats.queued -= 1;
    campaign.stats.sending += 1;
    await campaign.save();

    try {
      const { messageId } = await sendSms({
        deviceId: client.deviceId,
        to: m.phone,
        message: campaign.message,
      });
      m.status = 'sent';
      m.externalId = messageId;
      m.sentAt = new Date();
      campaign.stats.sending -= 1;
      campaign.stats.sent += 1;
      client.usage.smsThisMonth += 1;
      await client.save();
    } catch (e) {
      m.status = 'failed';
      m.error = e.response?.data?.message || e.message;
      campaign.stats.sending -= 1;
      campaign.stats.failed += 1;
      console.error(`[campaign ${campaign._id}] send failed: ${m.phone} — ${m.error}`);
    }
    await campaign.save();
    await sleep(campaign.throttleMs || 2000);
  }

  campaign.status = campaign.status === 'cancelled' ? 'cancelled' : 'sent';
  campaign.finishedAt = new Date();
  await campaign.save();
  console.log(`[campaign ${campaign._id}] finished, status=${campaign.status}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Background tick — finds scheduled campaigns whose time has come and runs them.
 * Runs every 30s from index.js.
 */
export async function runScheduledCampaigns() {
  try {
    const due = await Campaign.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() },
    }).limit(10);

    for (const c of due) {
      const client = await c.populate('clientId');
      runCampaign(c, client.clientId).catch(err => {
        console.error(`[scheduled ${c._id}]`, err);
      });
    }
  } catch (e) {
    console.error('[scheduler]', e);
  }
}
