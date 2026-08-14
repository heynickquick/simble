import axios from 'axios';

const BASE = process.env.TEXTBEE_API_URL;
const KEY = process.env.TEXTBEE_API_KEY;

if (!BASE || !KEY) {
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
 */
export async function sendSms({ deviceId, to, message }) {
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
  try {
    const { data } = await http.get(`/api/v1/gateway/devices/${deviceId}`);
    return { online: data?.status === 'online', lastSeen: data?.lastSeen, raw: data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}
