# Simble — Architecture

## Current state (deployed on VPS)

```
                    ┌──────────────────────────────────────┐
                    │  Asuncion, Paraguay (Nick)           │
                    │  - browser → https://simble.unscale.cloud│
                    └──────────────┬───────────────────────┘
                                   │ HTTPS
                                   ▼
                    ┌──────────────────────────────────────┐
                    │  Hostinger KVM 4 (US East)           │
                    │  IP: 72.60.63.202                    │
                    │                                      │
                    │   nginx (system) :443 → 4000/8880   │
                    │                                      │
                    │  ┌──────────────┐  ┌──────────────┐  │
                    │  │  web (Vue SPA)│  │  watchdog   │  │
                    │  │  nginx :8880  │  │  (polls relay)│ │
                    │  └──────┬───────┘  └──────┬───────┘  │
                    │         │                 │           │
                    │  ┌──────▼─────────────────▼──────┐   │
                    │  │  campaign-manager (Express)    │   │
                    │  │  :4000                         │   │
                    │  │  - JWT auth, multi-tenant      │   │
                    │  │  - clients/contacts/campaigns  │   │
                    │  │  - throttled send + scheduler  │   │
                    │  │  - channel dispatcher          │   │
                    │  └──────┬─────────────────────────┘   │
                    │         │                              │
                    │  ┌──────▼─────────┐  ┌──────────────┐ │
                    │  │  mongodb:7     │  │  sms-relay   │ │
                    │  │  :27017        │  │  :4010       │ │
                    │  │                │  │  - long-poll │ │
                    │  │                │  │  - tz window │ │
                    │  │                │  │  - hourly cap│ │
                    │  └────────────────┘  └──────┬───────┘ │
                    │                              │         │
                    └──────────────────────────────┼─────────┘
                                                   │ HTTPS long-poll
                                                   ▼
                    ┌──────────────────────────────────────┐
                    │  Friend's house, USA (or anywhere)   │
                    │  - 2-3 Android phones                 │
                    │  - Local SIMs (Tello/Mint/etc)        │
                    │  - Simble Gateway app (Kotlin)        │
                    │  - Termux + phone-agent (fallback)    │
                    │  - Optional UPS / USB hub             │
                    └──────────────────────────────────────┘
```

The VPS hosts the control plane (web UI, campaign-manager, sms-relay, mongo). Phones are dumb gateways — they just long-poll for queued messages and send via the local SIM. The architecture is region-agnostic: phones can be in any country with any local SIM.

---

## Phase 2 — campaign-manager

`campaign-manager` (`services/campaign-manager/`):
- Per-client JWT auth (`Client` model, bcrypt password hash, 7-day token)
- Per-client contact lists, campaigns, quotas
- Throttled send loop (default 1 msg / 2 sec per phone)
- Webhook receiver for sms-relay delivery reports
- Scheduled-campaign tick (every 30s)
- Stripe-ready (Phase 4)

### SMS gateway adapter (`src/services/textbee.js`)

Supports three modes selected at boot:
1. **sms-relay** (preferred) — our own service, no FCM, long-poll
2. **textbee** (legacy) — third-party, Firebase-dependent
3. **mock** — simulates sends, useful for dev/CI

The adapter exposes one function:
```js
sendSms({ deviceId, to, message, clientId, campaignId }) -> { messageId, status, raw? }
```
The `deviceId` parameter is the **sms-relay device token** in relay mode, the textbee device _id in textbee mode. The scheduler doesn't need to care.

---

## Phase 3 — sms-relay

`sms-relay` (`services/sms-relay/`):
- **Per-device token** auth (`sim_xxx...`) — phone-agent and Android app both use it
- **Long-poll** at `GET /devices/:token/poll` — phone holds connection for up to 30s waiting for a queued message
- **Server-to-server auth** at `POST /messages` — campaign-manager uses the `SMS_RELAY_SECRET` bearer token
- **Delivery reports** at `POST /devices/:token/messages/:id/report` — phone reports back, relay forwards to campaign-manager webhook
- **QR pairing** at `GET /devices/:token/qr` — returns a pretty HTML page with a scannable QR
- **Heartbeat** at `POST /devices/:token/heartbeat` — phone pings every 5 min, includes battery + network type

### Timezone-aware throttling

Each `Device` stores:
- `timezone` — IANA string, e.g. `America/Asuncion`, `Europe/London`
- `sendWindowStartHour` / `sendWindowEndHour` — defaults 9 / 21
- `smsPerHour` — defaults 100
- `smsThisHour` / `hourResetAt` — auto-reset on hour boundary

When `POST /messages` is called, the relay:
1. Checks `isWithinSendWindow()` using `Intl.DateTimeFormat` with the device timezone
2. Checks `smsThisHour < smsPerHour` (after `resetHourlyIfNeeded()`)
3. If either check fails, returns `429 { error: 'outside_send_window' | 'hourly_cap_reached', retryable: true }`

The scheduler in campaign-manager sees `retryable: true` and puts the message back in `status: 'queued'` instead of failing it. Next tick (within 30s, or sooner if a queue is filled) it tries again. This means a campaign running through Paraguay's 9pm-9am window will auto-pause and resume when the device's local 9am hits.

---

## Phase 3 — watchdog

`watchdog` (`services/watchdog/`):
- Polls sms-relay device status every 60s
- If a device is offline for >5 min, sends a Telegram alert
- Recovery alert when device comes back online
- One-time startup notification
- Cooldown between repeat alerts (default 30 min)

Needs `TELEGRAM_BOT_TOKEN` and `DEVICE_IDS` in env to actually alert. Deployed but running with placeholder config.

---

## Phase 5 — channel adapter pattern

```
campaign-manager
        │
        ├── SMS adapter     → textbee.js (sms-relay or textbee or mock)
        ├── Telegram        → telegram.js (Bot API, free)
        ├── WhatsApp        → (planned) Meta Cloud API
        ├── Viber           → (planned) Business Messages
        ├── Line            → (planned) Official Account API
        └── Zalo            → (planned) Zalo OA API
```

The dispatcher lives in `src/services/scheduler.js`:

```js
const channels = {
  sms: {
    send: sendSms,
    getRecipient: (m, contact) => contact.phone,
  },
  telegram: {
    send: sendTelegram,
    getRecipient: (m, contact) => contact.chatId,
    getCredentials: (client) => client.getTelegramBotToken(),
  },
};
```

Each adapter implements:
```js
async send({ to, message, [deviceId] | [botToken] }) -> { messageId, status }
```

Optional:
- `getRecipient(m, contact)` — returns the channel-specific recipient (default: `contact.phone`)
- `getCredentials(client)` — returns per-client credentials like a bot token (default: empty)

**Adding a new channel** = one new file (`src/services/whatsapp.js`) + one map entry. Nothing else needs to change. The unified `Contact` model already supports multiple channel IDs (`phone`, `chatId`, with room to add `whatsappId`, `viberId`, etc.).

The campaign channel field accepts any string; the API validates `sms` and `telegram` for now and rejects anything else with 400.

### Why this matters

Different regions need different channels:
- **Paraguay / Argentina / Brazil**: WhatsApp dominant, Telegram rising, SMS legacy
- **Vietnam**: Zalo dominant, Line fading
- **Thailand / Japan / Taiwan**: Line dominant
- **Greece / Eastern EU**: Viber dominant
- **Iran / Russia / CIS**: Telegram dominant
- **India**: WhatsApp dominant, SMS for OTP
- **China**: WeChat only (out of scope — Chinese entity required)

One Simble instance can serve all of them; the client picks the channel per campaign based on their audience.

---

## Country value props

- **USA / Canada**: SMS is reliable + cheap via Tello/Mint prepaid. SMS is the default channel.
- **Latin America**: WhatsApp dominates, SMS for OTP and older demographics. Telegram is growing fast.
- **EU**: SMS is solid for transactional; WhatsApp for marketing. Some GDPR considerations.
- **CIS / Iran**: Telegram is the only practical channel — SMS is heavily filtered.
- **SE Asia**: Line (Thailand/Japan/Taiwan), Zalo (Vietnam), WhatsApp (Singapore). SMS is still huge in Indonesia and Philippines.
- **Africa**: SMS is still king for OTP, WhatsApp for marketing in urban areas.
- **China**: WeChat only. Out of scope for now.

The control plane lives in Paraguay but the sending happens wherever the SIM is. A Simble client in Tokyo can run a WhatsApp campaign to customers in São Paulo, with phones in both countries — same dashboard, same API.
