# Simble SMS Relay

The bridge between campaign-manager and the phone. No Firebase, no FCM, no third-party Android code.

## Architecture

```
campaign-manager (Node, VPS)
       │
       │  POST /messages  (with SMS_RELAY_SECRET)
       │  { deviceToken, to, message, clientId, campaignId }
       ▼
sms-relay (Node, VPS) — this service
       │
       │  stores message in MongoDB (status: queued)
       │
       │  long-poll: phone GET /devices/:token/poll
       │  phone receives: { id, to, message }
       ▼
phone-agent (Node, Termux, on the friend's Android phone)
       │
       │  sends SMS via Termux:API termux-sms-send
       │  POST /devices/:token/messages/:id/report
       │  { status: 'delivered' | 'failed', error? }
       ▼
sms-relay updates message status, fires webhook to campaign-manager
```

## Endpoints

### Server-to-server (campaign-manager uses these)
- `POST /devices` — register a device, returns `{id, name, token, ...}` (token shown ONCE on creation)
- `GET /devices` — list devices
- `POST /messages` — queue an SMS, body: `{deviceToken, to, message, clientId?, campaignId?}` → `{id, status: 'queued'}`

### Device-side (phone-agent uses these)
- `GET /devices/:token/poll` — long-poll for next queued message (up to 30s, returns 204 on timeout)
- `POST /devices/:token/messages/:id/report` — report delivery, body: `{status: 'delivered'|'failed', error?}`
- `POST /devices/:token/heartbeat` — keep-alive, body: `{batteryLevel?, networkType?}`

### Public
- `GET /health` — health check
- `GET /devices/:token/status` — public status (for monitoring)

## Auth

- **Server-to-server**: `Authorization: Bearer ${SMS_RELAY_SECRET}` header
- **Device**: device token is in the URL path. Token is generated on device creation (`sim_` + 48 hex chars). Devices are validated by DB lookup.

## Setup

```bash
cd services/sms-relay
cp .env.example .env
# Edit .env: MONGODB_URI, SMS_RELAY_SECRET
# (MONGODB_SECRET should match the campaign-manager's shared secret)
docker compose up -d --build sms-relay
```

## Phone agent

See `phone-agent/README.md` for installing the Termux-based agent on the Android phone.
