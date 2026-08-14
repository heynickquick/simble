import axios from 'axios';

const BASE = process.env.TEXTBEE_API_URL;
const KEY = process.env.TEXTBEE_API_KEY;
const MOCK = process.env.TEXTBEE_MOCK === 'true' || process.env.TEXTBEE_MOCK === '1';

if (MOCK) {
  console.log('[textbee] ⚠️  MOCK MODE — SMS will be simulated, not actually sent');
} else if (!BASE || !KEY) {
  console.warn('[textbee] TEXTBEE_API_URL or TEXTBEE_API_KEY missing — sendSms will fail');
}

const http = axios.create({
  baseURL: BASE,
  headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
  timeout: 30_000,
});

/**
 * Send an SMS through textbee.
 * textbee API: POST /api/v1/gateway/devices/{deviceId}/send-sms
 * body: { phoneNumber, message }
 *
 * In MOCK mode, returns a fake messageId and simulates delivery via a timer.
 */
export async function sendSms({ deviceId, to, message }) {
  if (MOCK) {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[textbee:MOCK] → ${to} (${message.length} chars) id=${messageId}`);
    // Simulate delivery report after 3 seconds
    setTimeout(() => {
      const url = process.env.SIMBLE_WEBHOOK_URL;
      if (url) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: messageId, status: 'delivered', phone: to }),
        }).catch(err => console.error('[textbee:MOCK] webhook call failed', err.message));
      }
    }, 3000);
    return { messageId, status: 'sent', mock: true };
  }

  if (!deviceId) throw new Error('deviceId required');
  const { data } = await http.post(`/api/v1/gateway/devices/${deviceId}/send-sms`, {
    phoneNumber: to,
    message,
  });
  return {
    messageId: data?.id || data?.messageId,
    status: data?.status || 'sent',
    raw: data,
  };
}

export async function getDeviceStatus(deviceId) {
  if (MOCK) return { online: true, lastSeen: new Date().toISOString(), mock: true };
  try {
    const { data } = await http.get(`/api/v1/gateway/devices/${deviceId}`);
    return { online: data?.status === 'online', lastSeen: data?.lastSeen, raw: data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}
