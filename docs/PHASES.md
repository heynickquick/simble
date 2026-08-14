# Simble — Project Phases

## Phase 1 — textbee stack on VPS ⏳ IN PROGRESS
- [x] textbee source cloned to `~/simble/textbee` on VPS
- [x] docker-compose up for mongodb + campaign-manager
- [ ] textbee-api + textbee-web brought up (needs Firebase config — blocked on Nick's Google account)
- [ ] First phone paired via QR
- [ ] First SMS sent end-to-end

## Phase 2 — campaign-manager ✅ DEPLOYED
- [x] `services/campaign-manager/` scaffold built (16 files, ~600 LOC)
- [x] Mongoose models: Client, Contact, Campaign
- [x] JWT auth, per-client contact isolation
- [x] Bulk CSV import endpoint
- [x] Campaign send + throttled runner
- [x] textbee delivery webhook receiver
- [x] Scheduled-campaign tick
- [x] Docker service wired into docker-compose.yml
- [x] Caddy route `/crm/*` → campaign-manager
- [x] **Deployed and validated end-to-end on VPS** (smoke test passed all 8 endpoints)
- [ ] Stripe billing integration
- [x] **Web UI** (`web/`) — login, dashboard, contacts, campaigns, settings. Deployed on port 8880.

## Phase 3 — friend-site reliability 🟡 PARTIALLY DONE
- [x] **Watchdog service built** (`services/watchdog/`) — polls textbee, alerts via Telegram
- [x] Watchdog deployed on VPS
- [ ] Watchdog needs real DEVICE_IDS + Telegram bot token to actually alert
- [ ] Friend-site hardware kit (phones, Pi, UPS, smart plug) — needs purchase
- [ ] Friend runbook (already exists, needs printing)
- [ ] UPS + smart plug setup guide
- [ ] Power outage recovery test

## Phase 4 — economics validation ⏳ PENDING
- [x] Economics doc (`docs/ECONOMICS.md`)
- [ ] Per-client pricing model finalized
- [ ] Stripe integration
- [ ] First 3 paying clients
- [ ] Margin analysis at scale
- [ ] 10DLC research (for future high-volume tiers)

## Phase 5 — multi-channel expansion ⏳ NEXT
- [ ] Channel adapter interface in campaign-manager
- [ ] Telegram adapter (free, easiest first)
- [ ] WhatsApp Cloud adapter (Meta Business verification needed)
- [ ] Viber adapter
- [ ] Line adapter
- [ ] Zalo adapter
- [ ] Unified contact model (one contact, many channel IDs)
- [ ] Channel preference routing + fallbacks
- [ ] Per-channel cost tracking + reporting

## Out of scope (for now)
- WeChat (Chinese entity + banking required — barrier too high)
- 10DLC registration (defer until real A2P demand)
- Voice (different problem, different gateway)
- MMS (textbee supports it but not a marketing use case)

## How to deploy
```bash
# from local: commit + push
cd C:\Users\Nick\projects\simble
git add . && git commit -m "..." && git push

# on VPS: pull + deploy
ssh cwai
bash /tmp/deploy.sh  # (or copy deploy/deploy-vps.sh to /tmp and run)
```
