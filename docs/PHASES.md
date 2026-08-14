# Simble — Project Phases

## Phase 1 — textbee foundation (week 1)
- [x] Research: identified textbee as best fit
- [x] Gameplan written
- [x] Project scaffolded at `C:\Users\Nick\projects\simble\`
  - [x] AGENTS.md, README.md, .env.example, .gitignore
  - [x] docker-compose.yml + Caddyfile
  - [x] deploy/setup-vps.sh + deploy/first-deploy.sh
  - [x] runbook/FRIEND-RUNBOOK.md
  - [x] infra/firebase-setup.md
  - [x] docs/ARCHITECTURE.md, ECONOMICS.md, PHASES.md
- [ ] VPS provisioned (Hostinger KVM 4, US East, Ubuntu 24.04)
- [ ] VPS hardened (`deploy/setup-vps.sh` run)
- [ ] textbee docker-compose deployed (`deploy/first-deploy.sh`)
- [ ] DNS A record + SSL (Caddy auto-cert)
- [ ] Firebase project created + creds in `.env`
- [ ] First phone paired via QR
- [ ] First SMS sent end-to-end

## Phase 2 — campaign-manager (week 2-3) ✅ scaffolded, 🟡 needs deployment
- [x] `services/campaign-manager/` scaffold built (16 files, ~600 LOC)
- [x] Mongoose models: Client, Contact, Campaign
- [x] JWT auth, per-client contact isolation
- [x] Bulk CSV import endpoint
- [x] Campaign send + throttled runner
- [x] textbee delivery webhook receiver
- [x] Scheduled-campaign tick
- [x] Docker service wired into docker-compose.yml
- [x] Caddy route `/crm/*` → campaign-manager
- [ ] Local end-to-end test (need textbee instance + test device)
- [ ] Stripe billing integration
- [ ] Web UI for campaign-manager (currently API-only; clients use the dashboard for SMS, but need a campaign UI)

## Phase 3 — friend-site hardware kit (week 3)
- [ ] Hardware ordered (3 phones, Pi Zero 2W, UPS, USB hub)
- [ ] Friend runbook laminated and shipped
- [ ] Pi watchdog deployed (Telegram alert if phone offline >5 min)
- [ ] UPS tested (power outage simulation)
- [ ] Hardware shipped to friend
- [ ] Friend-side setup verified end-to-end

## Phase 4 — economics validation
- [ ] Per-client pricing model finalized
- [ ] Stripe integration (or local Paraguay payment method)
- [ ] First 3 paying clients
- [ ] Margin analysis at scale
- [ ] 10DLC research (for future high-volume tiers)

## Phase 5 — multi-channel expansion
- [ ] Channel adapter interface defined
- [ ] Telegram adapter (easiest first — free, no approval)
- [ ] WhatsApp Cloud adapter (Meta Business verification)
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
