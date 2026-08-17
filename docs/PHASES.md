# Simble — Project Phases

> **Status legend:** ✅ done · 🟡 in progress / partial · ❌ blocked · ⏳ pending

---

## Phase 1 — SMS gateway ✅ DONE (custom build, no third-party Android code)

**What got built (all on our own code, no textbee, no Firebase, no FCM):**
- [x] **sms-relay service** (`services/sms-relay/`) — Node.js Express + Mongoose. Long-poll API for phones, server-to-server auth for campaign-manager, MongoDB for queue + device registry.
- [x] **Phone agent** (`phone-agent/`) — ~120 LOC Node.js script that runs in Termux on the friend's Android phone. Polls the relay, sends SMS via Termux:API, reports back, heartbeats.
- [x] **textbee removed** entirely from the stack (deleted from VPS, removed from compose, no remaining code references).
- [x] **End-to-end validated** on the public domain: queue → poll → send → report → stats, all working.
- [x] **No FCM, no Firebase, no third-party Android code.** ~250 LOC total (relay + agent) is all the Android-side code that touches the SIM.

**To go live (needs a real phone, not a code change):**
- [ ] Install Termux + Termux:API on a spare Android phone (from F-Droid, not Play Store)
- [ ] Run `phone-agent/agent.js` on the phone with `RELAY_URL` and `DEVICE_TOKEN` set
- [ ] Insert a Tello/Mint SIM
- [ ] Ship the phone to your friend in the USA
- [ ] Grant Termux:API the SMS permission
- [ ] (Optional) Set up `termux-boot` for auto-start on reboot

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
