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
- [x] Mongoose models: Client, Contact, Campaign
- [x] JWT auth, per-client contact isolation
- [x] Bulk CSV import endpoint
- [x] Campaign create + throttled send runner (default 1 msg / 2s)
- [x] textbee delivery webhook receiver (also handles sms-relay reports)
- [x] Scheduled-campaign tick (every 30s)
- [x] Stripe-ready data model (plan, limits, usage)
- [x] Deployed and validated end-to-end on VPS
- [x] **Web UI** (`web/`) — login, dashboard, contacts, campaigns, settings
- [x] **SMS gateway adapter** (`src/services/textbee.js`) — supports sms-relay, textbee, or mock mode
- [x] **HTTPS at https://simble.unscale.cloud** with Let's Encrypt cert

**Remaining:**
- [ ] Stripe billing integration
- [ ] Inbound SMS handler (currently only outbound)
- [ ] CSV export of campaign results
- [ ] E.164 phone validation on contact import

---

## Phase 3 — friend-site reliability 🟡 PARTIAL

- [x] **Watchdog service** (`services/watchdog/`) — polls textbee/sms-relay device health, alerts via Telegram
- [x] Watchdog deployed on VPS (running with placeholder config)
- [ ] Watchdog needs real `DEVICE_IDS` + Telegram bot token
- [ ] Friend-site hardware (2-3 phones, Tello/Mint SIMs, Termux install) — **only the phone-agent setup is left**
- [ ] Friend runbook (already written at `runbook/FRIEND-RUNBOOK.md`, needs printing)
- [ ] Power outage recovery test

---

## Phase 4 — economics + monetization ⏳ PENDING

- [x] Economics doc (`docs/ECONOMICS.md`)
- [ ] Per-client pricing model finalized (draft: Starter $49, Growth $149, Agency $399)
- [ ] Stripe integration
- [ ] First 3 paying clients
- [ ] Margin analysis at scale
- [ ] 10DLC research (for high-volume tiers)

---

## Phase 5 — multi-channel expansion ⏳ NEXT

- [ ] Channel adapter interface formalized in code
- [ ] **Telegram adapter** (free, easiest first, ~150 LOC, needs bot token from @BotFather)
- [ ] **WhatsApp Cloud adapter** (Meta Business verification, $0.005-0.09/conversation)
- [ ] **Viber / Line / Zalo adapters**
- [ ] Unified contact model (one contact, many channel IDs)
- [ ] Channel preference routing + fallbacks
- [ ] Per-channel cost tracking + reporting

---

## Out of scope

- WeChat (Chinese entity + banking required)
- 10DLC registration (defer until real A2P demand)
- Voice (different problem, different gateway)
- MMS

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
