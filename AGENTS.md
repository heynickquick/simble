# Simble

## Purpose
Self-hosted mobile messaging marketing platform. Send SMS from your own SIM cards, expand to multi-channel (WhatsApp, Telegram, Viber, Line, Zalo) for international markets. Run by Nick Quick from Asuncion, Paraguay; hardware (phones + SIMs) lives at a friend's house in the USA.

## If you're a new agent picking this up

**Read [HANDOFF.md](HANDOFF.md) first.** It has the full context, the current state, the immediate blocker (Firebase), and specific tasks to do. Then come back here for project memory.

## Current blocker

textbee-api (the SMS gateway backend) is **down because Firebase is not configured.** Firebase Cloud Messaging (FCM) is how textbee pushes "send this SMS" commands to the Android app. Without it, textbee-api crashes at boot.

**To unblock:** create a Firebase project, fill in the `FIREBASE_*` env vars on the VPS, rebuild textbee-android with the `google-services.json` embedded, install the APK on Nick's phone, pair via QR code at https://sms.simble.unscale.cloud. Full step-by-step in HANDOFF.md.

## Architecture (high level)
- **VPS** (Hostinger KVM 4, US East): runs textbee API + web + MongoDB + **campaign-manager** + **web UI** + **watchdog** + Caddy
- **Friend's house (USA)**: 2-3 spare Android phones, each with Tello/Mint SIM, running textbee Android app
- **Nick (Asuncion)**: manages everything via web UI, REST API
- **Phase 5+**: add channel adapters to campaign-manager for Telegram, WhatsApp Cloud, Viber, Line, Zalo

## Stack
- **Gateway**: [textbee](https://github.com/vernu/textbee) (Next.js + NestJS + MongoDB + Kotlin Android)
- **Campaign manager** (`services/campaign-manager/`): Node.js + Express + Mongoose. Multi-tenant. Fronts textbee, owns the per-client data model.
- **Web UI** (`web/`): Vanilla ES module + Vue 3 (CDN), served by nginx. No build step.
- **Watchdog** (`services/watchdog/`): Node.js, polls textbee device health, alerts via Telegram on outages.
- **Reverse proxy + SSL**: Caddy (auto Let's Encrypt) — not yet deployed (needs a domain)
- **Database**: MongoDB 7
- **OS**: Ubuntu 24.04 LTS on Hostinger KVM 4 (4 vCPU, 8GB RAM, 200GB NVMe)

## Infrastructure
- **VPS**: Hostinger, IP `72.60.63.202`, hostname `srv1399138`
- **SSH access**: `ssh cwai` (alias in `~/.ssh/config`, key: `id_ed25519_hostinger`)
- **Already provisioned**: Docker 29.x installed, Ubuntu 24.04.4 LTS, deploy user created
- **Currently running services on the VPS**:
  - MongoDB (mongo:7) on internal:27017
  - campaign-manager on internal:4000 + host:4000
  - web (nginx serving Simble UI) on internal:8080 + host:8880
  - watchdog polling textbee device status (placeholder until textbee is up)
  - Other unrelated services: open-seo, karakeep, freshrss, n8n, reachinbox, ladder, nginx (on 80/443)
- **Domain**: TBD (need a domain for `simble.YOUR_DOMAIN` and Caddy SSL)
- **Direct test access (no domain needed)**:
  - Web UI: http://72.60.63.202:8880
  - API: http://72.60.63.202:4000/health
- **Production access (needs domain + DNS)**:
  - Web UI: https://simble.YOUR_DOMAIN (via Caddy)
  - API: https://simble.YOUR_DOMAIN/api/* (via Caddy)

> **Why we replaced playSMS with our own campaign-manager:** playSMS would have meant a separate PHP stack, a custom gateway plugin, and a user model that doesn't match multi-tenant SaaS. A 600-LOC Node service does the same job, fits the existing data layer, and gives us a clean foundation for the multi-channel adapters in Phase 5.

## Stack
- **Gateway**: [textbee](https://github.com/vernu/textbee) (Next.js + NestJS + MongoDB + Kotlin Android)
- **Campaign manager** (built in-house, services/campaign-manager/): Node.js + Express + Mongoose. Multi-tenant. Fronts textbee, owns the per-client data model (clients, contacts, campaigns, delivery stats).
- **Reverse proxy + SSL**: Caddy (auto Let's Encrypt)
- **Database**: MongoDB 7 (shared between textbee and campaign-manager — separate DBs)
- **OS**: Ubuntu 24.04 LTS on Hostinger KVM 4 (4 vCPU, 8GB RAM, 200GB NVMe)

## Infrastructure
- **VPS**: Hostinger, IP `72.60.63.202`, hostname `srv1399138`
- **SSH access**: `ssh cwai` (alias in `~/.ssh/config`, key: `id_ed25519_hostinger`)
- **Already provisioned**: Docker 29.6.1 installed, Ubuntu 24.04.4 LTS
- **Pending**: deploy user creation, SSH hardening, UFW/fail2ban, project clone + deploy
- **Domain**: TBD (need a domain for `sms.<domain>` and `crm.<domain>`)

> **Why we replaced playSMS with our own campaign-manager:** playSMS would have meant a separate PHP stack, a custom gateway plugin, and a user model that doesn't match multi-tenant SaaS. A 600-LOC Node service does the same job, fits the existing data layer, and gives us a clean foundation for the multi-channel adapters in Phase 5.

## Key constraints
- **Carrier TOS**: Tello/Mint/Verizon consumer plans prohibit A2P/bulk SMS. Soft cap ~1,000-3,000 SMS/mo per line. High volume risks SIM flag/swap.
- **Latency**: VPS must be US East for low latency to phones at friend's house.
- **Phone uptime**: Android aggressively kills background apps. textbee app must be foreground/whitelisted. Pi-based watchdog alerts Nick if any phone goes dark.
- **Friend factor**: friend has zero technical knowledge. Hardware setup must be plug-and-play, documented with 1-page laminated runbook.

## Cost target
- $45-60/mo operating cost for 3-phone deployment
- 3 pricing tiers: Starter $49, Growth $149, Agency $399
- See [docs/ECONOMICS.md](docs/ECONOMICS.md) for full breakdown

## Active phase
See [docs/PHASES.md](docs/PHASES.md) for live tracker. Currently **Phase 1 + 2 deployed**, **Phase 3 watchdog built**, **Phase 5 next**.

## Important notes
- Do NOT use Tello/Mint/consumer SIMs for >1,000 SMS/day per line. Plan A2P fallback for high-volume tiers.
- Multi-channel expansion: Telegram first (free, easy), WhatsApp Cloud second (Meta Business verification), Viber/Line/Zalo later.
- WeChat is intentionally out of scope (requires Chinese entity + banking).
- Country-specific value props: WhatsApp dominant in LatAm/India, Line in JP/TW/TH, Viber in Eastern EU, Telegram in CIS/Iran, Zalo in Vietnam.
