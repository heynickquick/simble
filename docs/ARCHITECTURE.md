# Simble — Architecture

## Phase 1 — textbee foundation
```
Asuncion, PY (Nick)
   - web browser → textbee dashboard
       │
       │ HTTPS
       ▼
Hostinger KVM 4, US East
   - Caddy (SSL termination, auto Let's Encrypt)
   - textbee API (NestJS, port 3000)
   - textbee Web (Next.js, port 3000)
   - MongoDB 7 (port 27017, internal only)
       │
       │ HTTPS REST (phone polls API)
       ▼
Friend's house, USA
   - WiFi
   - 2-3 Android phones (Pixel 3a, Samsung A20, Moto G7)
   - Each: Tello/Mint SIM, textbee app, charging 24/7
```

## Phase 2 — multi-client campaign-manager
```
Client web UI  →  campaign-manager  →  textbee  →  Android phone  →  SMS
   (browser)       (Node + Mongo)      (REST)       (FCM + carrier)
```

`campaign-manager` (built in `services/campaign-manager/`):
- Per-client JWT auth
- Per-client contact lists, campaigns, quotas
- Throttled send loop (default 1 msg / 2 sec per phone)
- Webhook receiver for textbee delivery reports
- Scheduled-campaign tick (every 30s)
- Stripe-ready (Phase 4)

playSMS is no longer in the stack — the campaign-manager replaces it with a smaller, more focused service.

## Phase 3 — friend-site reliability
```
Friend's house additions:
   - Raspberry Pi Zero 2W watchdog
   - cron: pings each phone's gateway endpoint every 60s
   - alert: Telegram message to Nick if any phone offline >5 min
   - APC UPS for ~30 min ride-through
   - Anker 6-port USB hub for phone charging
```

## Phase 5 — multi-channel
```
campaign-manager
        │
        ├── SMS adapter    → textbee  (already wired)
        ├── Telegram       → Bot API (free)            [next up]
        ├── WhatsApp       → Meta Cloud API ($0.005-0.09/conv)
        ├── Viber          → Business Messages API
        ├── Line           → Official Account API
        └── Zalo           → Zalo OA API
```

Each adapter implements the same interface as `src/services/textbee.js`:
```
send({ to, message }) -> { externalId, status }
```

The unified contact model is the next data-model addition: one contact, many channel IDs (phone, telegram_chat_id, whatsapp_phone, viber_id, line_id, zalo_id). Smart routing with per-channel preference and fallbacks.

## Country value props
- **Paraguay / Argentina / Brazil**: WhatsApp dominant, Telegram rising, SMS legacy
- **Vietnam**: Zalo dominant, Line fading
- **Thailand / Japan / Taiwan**: Line dominant
- **Greece / Eastern EU**: Viber dominant
- **Iran / Russia / CIS**: Telegram dominant
- **India**: WhatsApp dominant, SMS for OTP
- **China**: WeChat only (out of scope — Chinese entity required)
