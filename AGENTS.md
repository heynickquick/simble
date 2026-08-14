# Mobile Messaging Marketing Platform

## Purpose
Self-hosted SMS marketing platform that uses consumer SIMs (US) instead of Twilio/A2P routes, expandable to multi-channel (WhatsApp, Telegram, Viber, Line, Zalo) for international markets. Run by Nick Quick from Asuncion, Paraguay; hardware (phones + SIMs) lives at a friend's house in the USA.

## Architecture (high level)
- **VPS** (Hostinger KVM 4, US East): runs textbee API + web + MongoDB + **campaign-manager** + Caddy
- **Friend's house (USA)**: 2-3 spare Android phones, each with Tello/Mint SIM, running textbee Android app
- **Nick (Asuncion)**: manages everything via web dashboard, REST API
- **Phase 5+**: add channel adapters to campaign-manager for Telegram, WhatsApp Cloud, Viber, Line, Zalo

## Stack
- **Gateway**: [textbee](https://github.com/vernu/textbee) (Next.js + NestJS + MongoDB + Kotlin Android)
- **Campaign manager** (built in-house, services/campaign-manager/): Node.js + Express + Mongoose. Multi-tenant. Fronts textbee, owns the per-client data model (clients, contacts, campaigns, delivery stats).
- **Reverse proxy + SSL**: Caddy (auto Let's Encrypt)
- **Database**: MongoDB 7 (shared between textbee and campaign-manager — separate DBs)
- **OS**: Ubuntu 24.04 LTS on Hostinger KVM 4 (4 vCPU, 8GB RAM, 200GB NVMe)

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
See [docs/PHASES.md](docs/PHASES.md) for live tracker. Currently **Phase 1**.

## Important notes
- Do NOT use Tello/Mint/consumer SIMs for >1,000 SMS/day per line. Plan A2P fallback for high-volume tiers.
- Multi-channel expansion: Telegram first (free, easy), WhatsApp Cloud second (Meta Business verification), Viber/Line/Zalo later.
- WeChat is intentionally out of scope (requires Chinese entity + banking).
- Country-specific value props: WhatsApp dominant in LatAm/India, Line in JP/TW/TH, Viber in Eastern EU, Telegram in CIS/Iran, Zalo in Vietnam.
