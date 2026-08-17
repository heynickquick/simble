import { Campaign } from '../models/Campaign.js';
import { Contact } from '../models/Contact.js';
import { sendSms } from './textbee.js';
import { sendTelegram } from './telegram.js';

/**
 * Channel dispatcher. Each adapter implements:
 *   async send({ deviceId, to, message, client }) -> { messageId, status, raw? }
 * and optionally throws { response: { status, data } } for retryable errors.
 */
const channels = {
  sms: {
    send: sendSms,
    // For SMS, "to" is a phone number from Contact.phone
    getRecipient: (m, contact) => contact.phone,
  },
  telegram: {
    send: sendTelegram,
    // For Telegram, "to" is the chat_id from Contact.chatId
    getRecipient: (m, contact) => contact.chatId,
    // deviceId isn't needed; botToken comes from client
    getCredentials: (client) => client.getTelegramBotToken(),
  },
};

/**
 * Run a campaign end-to-end. Updates the campaign doc as it goes.
 * Throttles per `campaign.throttleMs` to be friendly to consumer SIMs.
 */
export async function runCampaign(campaign, client) {
  campaign.status = 'sending';
  campaign.startedAt = new Date();
  await campaign.save();

  console.log(`[campaign ${campaign._id}] starting on channel=${campaign.channel}, ${campaign.stats.queued} queued`);

  const channel = channels[campaign.channel] || channels.sms;

  // Look up contacts for chat_id/phone lookup
  const contacts = await Contact.find({ _id: { $in: campaign.messages.map(m => m.contactId) } });
  const contactById = new Map(contacts.map(c => [String(c._id), c]));

  for (const m of campaign.messages) {
    if (m.status !== 'queued') continue;
    if (campaign.status === 'cancelled') break;

    const contact = contactById.get(String(m.contactId));
    if (!contact) {
      m.status = 'failed';
      m.error = 'contact not found';
      campaign.stats.queued -= 1;
      campaign.stats.failed += 1;
      await campaign.save();
      continue;
    }

    const recipient = channel.getRecipient(m, contact);
    if (!recipient) {
      m.status = 'failed';
      m.error = `no ${campaign.channel === 'telegram' ? 'chat_id' : 'phone'} for contact`;
      campaign.stats.queued -= 1;
      campaign.stats.failed += 1;
      await campaign.save();
      continue;
    }

    m.status = 'sending';
    campaign.stats.queued -= 1;
    campaign.stats.sending += 1;
    await campaign.save();

    try {
      const sendArgs = {
        to: recipient,
        message: campaign.message,
      };
      if (channel.getCredentials) {
        sendArgs.botToken = channel.getCredentials(client);
      } else {
        sendArgs.deviceId = client.deviceId;
      }

      const result = await channel.send(sendArgs);
      m.status = 'sent';
      m.externalId = result.messageId;
      m.sentAt = new Date();
      campaign.stats.sending -= 1;
      campaign.stats.sent += 1;
      if (campaign.channel === 'sms') {
        client.usage.smsThisMonth += 1;
        await client.save();
      }
    } catch (e) {
      // Retryable errors (rate limits, send windows) → put back in queue
      const status = e.response?.status;
      const errCode = e.response?.data?.error;
      if (status === 429 && (errCode === 'outside_send_window' || errCode === 'hourly_cap_reached')) {
        m.status = 'queued';
        campaign.stats.sending -= 1;
        campaign.stats.queued += 1;
        const target = m.phone || `contact=${m.contactId}`;
        console.log(`[campaign ${campaign._id}] held (${errCode}): ${target}`);
        // Don't sleep on rate-limit holds — let next tick pick it up
        continue;
      }
      // Non-retryable error
      m.status = 'failed';
      m.error = e.response?.data?.error || e.message;
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
