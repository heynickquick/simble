# Simble — Project Phases

> **Status legend:** ✅ done · 🟡 in progress / partial · ❌ blocked · ⏳ pending

---

## Phase 1 — textbee stack (SMS gateway) 🟡 PARTIALLY DONE — blocked on Firebase

**What got built:**
- [x] textbee source cloned to `~/simble/textbee` on VPS
- [x] textbee-web (Next.js dashboard) running at https://sms.simble.unscale.cloud
- [x] System nginx vhost + Let's Encrypt cert for the subdomain

**What's blocked on Firebase setup:**
- [ ] textbee-api running (currently stopped — crashes without Firebase credentials)
- [ ] Android APK built with `google-services.json` embedded
- [ ] First phone paired via QR code
- [ ] First real SMS sent end-to-end

**Why blocked:** textbee uses Firebase Cloud Messaging (FCM) to push "send this SMS" commands to the Android app. Android aggressively kills background apps, so FCM is the only reliable wake-up mechanism. No Firebase = textbee-api crashes at boot.

**To unblock (10-15 min with browser access):** see `HANDOFF.md` "Firebase setup" section. Steps: create Firebase project, enable FCM, create service account, fill `FIREBASE_*` env vars on the VPS, register an Android app in Firebase, build textbee-android APK with `google-services.json`, install APK on phone, pair via QR at https://sms.simble.unscale.cloud.

---

## Phase 2 — campaign-manager (multi-tenant CRM) ✅ DEPLOYED

**What got built:**
- [x] `services/campaign-manager/` — 16 files, ~600 LOC, Node 20 + Express + Mongoose
- [x] Mongoose models: Client, Contact, Campaign
- [x] JWT auth, per-client contact isolation
- [x] Bulk CSV import endpoint
- [x] Campaign create + throttled send runner (default 1 msg / 2s)
- [x] textbee delivery webhook receiver
- [x] Scheduled-campaign tick (every 30s)
- [x] Stripe-ready data model (plan, limits, usage)
- [x] Deployed and validated end-to-end on VPS (smoke test passed all 8 endpoints)
- [x] **Web UI** (`web/`) — login, dashboard, contacts, campaigns, settings
- [x] **Mock mode** (`TEXTBEE_MOCK=true`) — full e2e flow works without real hardware
- [x] **HTTPS at https://simble.unscale.cloud** with Let's Encrypt cert

**Built before Phase 1 finished.** Reason: `TEXTBEE_MOCK` mode lets the entire campaign-manager pipeline be developed and tested without textbee. We got the CRM working, the UI shipped, and the auth/billing shape locked in — all without waiting on Firebase. The moment textbee comes up, mock mode can be disabled with a one-line env change and real SMS flows.

**Remaining:**
- [ ] Stripe billing integration
- [ ] Inbound SMS handler (currently only outbound is built)
- [ ] CSV export of campaign results
- [ ] E.164 phone validation on contact import

---

## Phase 3 — friend-site reliability 🟡 PARTIALLY DONE

**What got built:**
- [x] **Watchdog service** (`services/watchdog/`) — polls textbee device health, alerts via Telegram
- [x] Watchdog deployed on VPS (running with placeholder config)

**Remaining:**
- [ ] Watchdog needs real `DEVICE_IDS` + Telegram bot token to actually alert (Nick creates bot via @BotFather in 2 min)
- [ ] Friend-site hardware (2-3 phones, Tello/Mint SIMs, Pi, UPS, smart plug) — needs purchase and ship to USA friend
- [ ] Friend runbook (already written at `runbook/FRIEND-RUNBOOK.md`, needs printing)
- [ ] Power outage recovery test

---

## Phase 4 — economics + monetization ⏳ PENDING

- [x] Economics doc (`docs/ECONOMICS.md`) — cost analysis + 3 pricing tiers
- [ ] Per-client pricing model finalized (draft: Starter $49, Growth $149, Agency $399)
- [ ] Stripe integration
- [ ] First 3 paying clients
- [ ] Margin analysis at scale
- [ ] 10DLC research (for high-volume tiers later)

---

## Phase 5 — multi-channel expansion ⏳ NEXT

The campaign-manager data model already supports `channel: 'sms' | 'telegram' | 'whatsapp' | 'viber' | 'line' | 'zalo'`. The SMS adapter is at `services/campaign-manager/src/services/textbee.js` and the `Campaign.channel` field exists. Adding new channels is a "write an adapter that implements `send({to, message}) -> {externalId, status}`" job.

- [ ] Channel adapter interface formalized in code
- [ ] **Telegram adapter** (free, easiest first, ~150 LOC, needs bot token from @BotFather)
- [ ] **WhatsApp Cloud adapter** (Meta Business verification, $0.005-0.09/conversation)
- [ ] **Viber adapter** (Business Messages API, $0.005-0.02/msg)
- [ ] **Line adapter** (Official Account, $0.01-0.05/msg)
- [ ] **Zalo adapter** (Zalo OA, Vietnam market)
- [ ] Unified contact model (one contact, many channel IDs)
- [ ] Channel preference routing + fallbacks
- [ ] Per-channel cost tracking + reporting

---

## Out of scope (for now)

- WeChat (Chinese entity + banking required — barrier too high)
- 10DLC registration (defer until real A2P demand)
- Voice (different problem, different gateway)
- MMS (textbee supports it but not a marketing use case)

---

## How to deploy

```bash
# from local: commit + push
cd C:\Users\Nick\projects\simble
git add . ; git commit -m "..." ; git push

# on VPS: pull + deploy
ssh cwai
cd /root/simble
git pull
docker compose up -d --build
```

---

## Chronological build order (for the record)

1. **Phase 1, partial** — textbee cloned, web UI up, textbee-api blocked on Firebase
2. **Phase 2, full** — campaign-manager + web UI + mock mode (built in parallel with Phase 1)
3. **Phase 3, partial** — watchdog service (built in parallel with Phase 2)
4. **DNS + SSL** — `simble.unscale.cloud` and `sms.simble.unscale.cloud` on existing nginx + certbot

**What's needed to finish Phase 1:** Firebase setup (10-15 min with browser access). Everything downstream is already wired and waiting.
