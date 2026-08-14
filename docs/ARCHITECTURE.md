# Simble — Architecture

## Current state (deployed on VPS)

```
                    ┌──────────────────────────────────────┐
                    │  Asuncion, Paraguay (Nick)           │
                    │  - browser → http://72.60.63.202:8880│
                    └──────────────┬───────────────────────┘
                                   │ HTTPS (eventually)
                                   ▼
                    ┌──────────────────────────────────────┐
                    │  Hostinger KVM 4, US East            │
                    │  IP: 72.60.63.202                    │
                    │                                      │
                    │  ┌──────────────┐  ┌──────────────┐  │
                    │  │  web (nginx) │  │  watchdog    │  │
                    │  │  :8080→8880  │  │  (polls textbee)  │
                    │  └──────┬───────┘  └──────┬───────┘  │
                    │         │                 │           │
                    │  ┌──────▼─────────────────▼──────┐   │
                    │  │  campaign-manager (Express)    │   │
                    │  │  :4000 (also host:4000)        │   │
                    │  │  - JWT auth                    │   │
                    │  │  - clients/contacts/campaigns  │   │
                    │  │  - throttled send              │   │
                    │  └──────┬─────────────────────────┘   │
                    │         │                              │
                    │  ┌──────▼─────────┐                   │
                    │  │  mongodb:7     │                   │
                    │  │  :27017        │                   │
                    │  └────────────────┘                   │
                    │                                      │
                    │  (textbee-api + textbee-web: not yet  │
                    │   running — needs Firebase)           │
                    └──────────────────────────────────────┘
                                   │
                                   │ (when textbee is up)
                                   ▼
                    ┌──────────────────────────────────────┐
                    │  Friend's house, USA                 │
                    │  - 2-3 Android phones                 │
                    │  - Tello/Mint SIMs                   │
                    │  - textbee app                       │
                    │  - Charging 24/7                     │
                    └──────────────────────────────────────┘
```

## Phase 2 — multi-client campaign-manager

```
Client web UI (Vue 3, port 8880)
  →  campaign-manager (Node + Express + Mongoose, port 4000)
  →  textbee (port 3000)  →  Android phone  →  SMS
```

`campaign-manager` (built in `services/campaign-manager/`):
- Per-client JWT auth
- Per-client contact lists, campaigns, quotas
- Throttled send loop (default 1 msg / 2 sec per phone)
- Webhook receiver for textbee delivery reports
- Scheduled-campaign tick (every 30s)
- Stripe-ready (Phase 4)

## Phase 3 — watchdog

`watchdog` (built in `services/watchdog/`):
- Polls each textbee device's status endpoint every 60s
- If a device is offline for >5 min, sends a Telegram alert
- Recovery alert when device comes back online
- One-time startup notification
- Cooldown between repeat alerts (default 30 min)

## Phase 5 — multi-channel

```
campaign-manager
        │
        ├── SMS adapter    → textbee  (already wired)
        ├── Telegram       → Bot API (free)            [next]
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
