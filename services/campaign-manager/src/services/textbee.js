import axios from 'axios';

// SMS gateway configuration. Three options:
//   1. SMS_RELAY_URL + SMS_RELAY_SECRET  → uses our own sms-relay (preferred, no FCM)
//   2. TEXTBEE_API_URL + TEXTBEE_API_KEY → uses textbee (Firebase-dependent, legacy)
//   3. SMS_GATEWAY_MOCK=true             → simulates sends for testing

const RELAY = process.env.SMS_RELAY_URL;
const RELAY_SECRET = process.env.SMS_RELAY_SECRET;
const TEXTBEE = process.env.TEXTBEE_API_URL;
const TEXTBEE_KEY = process.env.TEXTBEE_API_KEY;
const MOCK = process.env.SMS_GATEWAY_MOCK === 'true' || process.env.SMS_GATEWAY_MOCK === '1';

let mode = 'unknown';
if (MOCK) mode = 'mock';
else if (RELAY && RELAY_SECRET) mode = 'sms-relay';
else if (TEXTBEE && TEXTBEE_KEY) mode = 'textbee';

console.log(`[sms-gateway] mode=${mode}`);

const http = axios.create({
  baseURL: mode === 'sms-relay' ? RELAY : TEXTBEE,
  headers: mode === 'sms-relay'
    ? { 'Authorization': `Bearer ${RELAY_SECRET}`, 'Content-Type': 'application/json' }
    : { 'x-api-key': TEXTBEE_KEY, 'Content-Type': 'application/json' },
  timeout: 30_000,
});

/**
 * Send an SMS. `deviceId` is interpreted as follows:
 *   - sms-relay mode: the device TOKEN (sim_xxx...)
 *   - textbee mode: the device _id
 *
 * Returns { messageId, status, raw? }.
 */
export async function sendSms({ deviceId, to, message, clientId, campaignId }) {
  if (mode === 'mock') {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[sms-gateway:MOCK] → ${to} (${message.length} chars) id=${messageId}`);
    setTimeout(() => {
      const url = process.env.SIMBLE_WEBHOOK_URL;
      if (url) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: messageId, status: 'delivered', phone: to }),
        }).catch(err => console.error('[sms-gateway:MOCK] webhook call failed', err.message));
      }
    }, 3000);
    return { messageId, status: 'sent', mock: true };
  }

  if (!deviceId) throw new Error('deviceId (or device token) required');

  if (mode === 'sms-relay') {
    const { data } = await http.post('/messages', {
      deviceToken: deviceId,
      to, message, clientId, campaignId,
    });
    return { messageId: data.id, status: data.status, raw: data };
  }

  // textbee (legacy)
  const { data } = await http.post(`/api/v1/gateway/devices/${deviceId}/send-sms`, {
    phoneNumber: to,
    message,
  });
  return {
    messageId: data?.data?.id || data?.id,
    status: data?.data?.status || data?.status || 'sent',
    raw: data,
  };
}

export async function getDeviceStatus(deviceId) {
  if (mode === 'mock') return { online: true, lastSeen: new Date().toISOString(), mock: true };
  if (mode === 'sms-relay') {
    try {
      const { data } = await http.get(`/devices/${deviceId}/status`);
      return { online: data.online, lastSeen: data.lastSeen, raw: data };
    } catch (e) {
      return { online: false, error: e.message };
    }
  }
  try {
    const { data } = await http.get(`/api/v1/gateway/devices/${deviceId}`);
    const online = data?.data?.heartbeatEnabled !== false;
    return { online, lastSeen: data?.data?.updatedAt, raw: data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}
