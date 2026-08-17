import axios from 'axios';

/**
 * Telegram channel adapter.
 * Sends messages via the Telegram Bot API.
 *
 * Free, no per-message cost, no carrier SIM needed.
 * Works in CIS, Iran, parts of LatAm/EU, anywhere Telegram is popular.
 *
 * Setup:
 * 1. Message @BotFather on Telegram, send /newbot, get the token
 * 2. Set TELEGRAM_BOT_TOKEN in campaign-manager .env
 * 3. Each contact needs a chat_id (saved as Contact.chatId in Mongo)
 *
 * To get a user's chat_id: have them message your bot, then visit
 * https://api.telegram.org/bot<TOKEN>/getUpdates
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (BOT_TOKEN) {
  console.log(`[telegram] bot token configured (length=${BOT_TOKEN.length})`);
} else {
  console.log('[telegram] ⚠️  TELEGRAM_BOT_TOKEN not set — Telegram channel will fail');
}

const http = axios.create({
  baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`,
  timeout: 15_000,
});

/**
 * Send a Telegram message to a chat_id.
 * @param {object} opts
 * @param {string} opts.botToken - bot token (per-client override, falls back to env)
 * @param {string} opts.to - chat_id (string or number)
 * @param {string} opts.message - message text
 * @returns {Promise<{messageId, status}>}
 */
export async function sendTelegram({ botToken, to, message }) {
  const token = botToken || BOT_TOKEN;
  if (!token) throw new Error('Telegram: no bot token configured (set TELEGRAM_BOT_TOKEN in .env)');
  if (!to) throw new Error('Telegram: no chat_id (set Contact.chatId)');
  if (!message) throw new Error('Telegram: no message text');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await axios.post(url, {
    chat_id: to,
    text: message,
    parse_mode: 'HTML', // or 'MarkdownV2'
  }, { timeout: 15_000 });

  if (!r.data?.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(r.data)}`);
  }

  return {
    messageId: String(r.data.result.message_id),
    status: 'sent',
    chatId: r.data.result.chat.id,
  };
}

/**
 * Validate a bot token by calling getMe.
 * Useful for verifying the token at signup.
 */
export async function validateBotToken(token) {
  try {
    const r = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10_000 });
    return r.data?.ok ? r.data.result : null;
  } catch {
    return null;
  }
}
