# Simble — Project Phases

> **Status legend:** ✅ done · 🟡 in progress / partial · ❌ blocked · ⏳ pending

---

## Phase 1 — SMS gateway ✅ DONE (custom build, no third-party Android code)

**What got built (all on our own code, no textbee, no Firebase, no FCM):**
- [x] **sms-relay service** (`services/sms-relay/`) — Node.js Express + Mongoose. Long-poll API for phones, server-to-server auth for campaign-manager, MongoDB for queue + device registry, **QR pairing endpoint** at `/devices/:token/qr`.
- [x] **Android app** (`android-app/`) — Native Kotlin, ~600 LOC. Foreground service polls relay every 5s, sends via Android SmsManager, reports back. QR scanner for pairing, auto-start on boot, battery-optimization prompt, persistent notification.
- [x] **Phone agent** (`phone-agent/`) — ~120 LOC Node.js script for Termux, kept as a fallback for advanced users.
- [x] **textbee removed** entirely from the stack.
- [x] **End-to-end validated** on the public domain: queue → poll → send → report → stats, all working. QR pairing works.
- [x] **No FCM, no Firebase, no third-party Android code in the gateway.** The Android app is fully our code (Apache 2.0 / MIT-style license, fully auditable).

**Two ways to deploy on a phone:**
1. **Recommended (for non-technical users)**: build `android-app/` with Android Studio, sideload the APK, scan QR, done. No F-Droid, no Termux.
2. **Advanced (for headless deployments)**: install Termux + Termux:API from F-Droid, run `phone-agent/agent.js`. No APK build needed.

**To go live:**
- [ ] Build the APK: `cd android-app && ./build.sh` (or open in Android Studio)
- [ ] Sideload APK on a spare Android phone
- [ ] Insert Tello/Mint SIM
- [ ] Open Simble web UI → register a device → open the QR URL
- [ ] Open Simble Gateway app on the phone → "Set up" → "Scan QR code" → point at the screen
- [ ] Ship the phone to your friend in the USA
- [ ] Disable battery optimization on the phone
- [ ] Send a test campaign → it shows up in the app's notification → phone sends the SMS → reports back

---

## Phase 2 — campaign-manager (multi-tenant CRM) ✅ DEPLOYED

- [x] `services/campaign-manager/` — Node.js + Express + Mongoose
- [x] Mongoose models: Client, Contact, Campaign (+ Message subdoc)
- [x] JWT auth, per-client contact isolation
- [x] Bulk CSV import endpoint
- [x] Campaign create + throttled send runner (default 1 msg / 2s)
- [x] Webhook receiver for sms-relay delivery reports
- [x] Scheduled-campaign tick (every 30s)
- [x] Stripe-ready data model (plan, limits, usage)
- [x] Deployed and validated end-to-end on VPS
- [x] **Web UI** (`web/`) — login, dashboard, contacts, campaigns, settings
- [x] **SMS gateway adapter** (`src/services/textbee.js`) — supports sms-relay, textbee, or mock mode
- [x] **HTTPS at https://simble.unscale.cloud** with Let's Encrypt cert
- [x] **Timezone-aware send window** — `Device.timezone` (IANA string), `sendWindowStartHour`/`EndHour`. Returns 429 `outside_send_window` with `retryable: true` if outside the device's local 9-21 window.
- [x] **Per-device hourly cap** — `Device.smsPerHour` (default 100), `smsThisHour`, `hourResetAt`. Returns 429 `hourly_cap_reached` with `retryable: true` if the cap is hit. Auto-resets every hour.
- [x] **CSV import** now also accepts `chatId` (and aliases `chat_id`, `telegramId`, `TELEGRAM_ID`) — empty values don't wipe existing chat_ids on re-import.

**Remaining:**
- [ ] Stripe billing integration
- [ ] Inbound SMS handler (currently only outbound)
- [ ] CSV export of campaign results
- [ ] E.164 phone validation on contact import

---

## Phase 3 — friend-site reliability 🟡 PARTIAL

- [x] **Watchdog service** (`services/watchdog/`) — polls device health via sms-relay, alerts via Telegram
- [x] Watchdog deployed on VPS (running with placeholder config)
- [x] **Timezone-aware throttling** at the relay (sms-relay refuses to queue sends outside the device's local 9-21 window)
- [x] **Per-device hourly cap** at the relay (sms-relay refuses to queue sends once `smsThisHour >= smsPerHour`)
- [x] **Friend runbook** (`runbook/FRIEND-RUNBOOK.md`) — rewritten for the Android-app era, no more Pi, with a troubleshooting table
- [ ] Watchdog needs real `DEVICE_IDS` + Telegram bot token
- [ ] Friend-site hardware (2-3 phones, Tello/Mint SIMs) — needs APK build + sideload
- [ ] Power outage recovery test
- [ ] Print + ship runbook to friend

---

## Phase 4 — economics + monetization ⏳ PENDING

- [x] Economics doc (`docs/ECONOMICS.md`)
- [ ] Per-client pricing model finalized (draft: Starter $49, Growth $149, Agency $399)
- [ ] Stripe integration
- [ ] First 3 paying clients
- [ ] Margin analysis at scale
- [ ] 10DLC research (for high-volume tiers)

---

## Phase 5 — multi-channel expansion 🟡 IN PROGRESS

- [x] **Channel adapter interface** — `src/services/scheduler.js` has a `channels` dispatcher map. Each entry exposes `send({ to, message, [botToken] | [deviceId] })` and `getRecipient(m, contact)`. Adding a new channel = one new file + one map entry.
- [x] **Telegram adapter** (`src/services/telegram.js`) — uses the Bot API, free, no carrier SIM needed. Bot token configurable globally via `TELEGRAM_BOT_TOKEN` env or per-client via `Client.telegramBotToken`. Contact needs `chatId`. Includes a `validateBotToken` helper for the UI.
- [x] **Contact model** now stores `chatId` alongside `phone`
- [x] **Client model** now stores `telegramBotToken` (never returned via API)
- [x] **Campaign channel field** — `sms` or `telegram`; validation ensures telegram contacts have a `chatId`
- [x] **CSV import** accepts `chatId` / `chat_id` / `telegramId`
- [ ] **WhatsApp Cloud adapter** (Meta Business verification, $0.005-0.09/conversation)
- [ ] **Viber / Line / Zalo adapters**
- [ ] Per-channel cost tracking + reporting
- [ ] Channel preference routing + fallbacks
- [ ] Bulk telegram-message e2e test (needs a real bot token — message @BotFather)

---

## Out of scope

- WeChat (Chinese entity + banking required)
- 10DLC registration (defer until real A2P demand)
- Voice (different problem, different gateway)
- MMS
- iOS (Apple's background SMS restrictions make it not worth building)

---

## Region support

The app is **region-agnostic by design**. Any Android phone with a local SIM can be paired — the SMS originates from that SIM in that country. The only VPS-side requirement is HTTPS reachability. Heavy-filter countries (China, Iran, NK) may need a VPN on the phone; otherwise it's plug-and-play worldwide. Telegram and WhatsApp adapters are also global.

See `docs/ARCHITECTURE.md` for the channel adapter pattern.

---

## How to deploy

```bash
# from local
cd C:\Users\Nick\projects\simble
git add . ; git commit -m "..." ; git push

# on VPS
ssh cwai
cd /root/simble
git pull
docker compose up -d --build
```
