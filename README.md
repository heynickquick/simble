# Mobile Messaging Marketing Platform

Self-hosted SMS gateway + campaign management, expanding to multi-channel (WhatsApp, Telegram, Viber, Line, Zalo) for international markets.

**Status:** Phase 1 (textbee foundation). See [docs/PHASES.md](docs/PHASES.md).

## Architecture

```
Asuncion, PY (Nick) ──HTTPS──> Hostinger KVM 4 (US East)
                                    │
                                    ├── Caddy (SSL)
                                    ├── textbee API (NestJS)
                                    ├── textbee Web (Next.js)
                                    ├── campaign-manager (Node + Express)  ← multi-tenant CRM
                                    ├── MongoDB 7
                                    │
                                    └──HTTPS──> Friend's house, USA
                                                 ├── 2-3 Android phones
                                                 ├── Tello/Mint SIMs
                                                 └── (Phase 3) Pi watchdog
```

The `campaign-manager` service in `services/campaign-manager/` is the per-client CRM layer: clients, contacts, campaigns, quotas. It calls textbee to actually send.

## Quickstart

### 1. Provision VPS
- Hostinger **KVM 4** (or KVM 2 to start cheaper), Ubuntu 24.04, **US East** datacenter
- Add your SSH public key during setup
- Note the public IP

### 2. Harden the VPS
```bash
ssh root@YOUR_VPS_IP
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-vps.sh)
# Or: scp deploy/setup-vps.sh root@YOUR_VPS_IP:~/ && ssh root@YOUR_VPS_IP "bash setup-vps.sh"
```

### 3. Clone this repo + textbee
```bash
ssh deploy@YOUR_VPS_IP
git clone https://github.com/YOUR_GH_USER/msg-platform.git ~/msg-platform
cd ~/msg-platform
git clone --depth 1 https://github.com/vernu/textbee.git textbee
cp .env.example .env
# Edit .env: DOMAIN, JWT_SECRET, MONGO passwords, Firebase creds
```

### 4. Configure Firebase
See [infra/firebase-setup.md](infra/firebase-setup.md). Drop `firebase-credentials.json` into `infra/`.

### 5. Deploy
```bash
./deploy/first-deploy.sh
```

### 6. Configure DNS
Point `sms.yourdomain.com` to VPS IP. Caddy auto-issues Let's Encrypt.

### 7. Onboard a phone
- Open `https://sms.yourdomain.com` → sign up
- Settings → Devices → Generate API key
- Install textbee Android app on the phone: https://textbee.dev/download
- Scan the QR code shown in the dashboard
- Phone shows "online" — ready to send

## Repository layout
```
msg-platform/
├── README.md                  # this file
├── AGENTS.md                  # project memory for AI agents
├── .env.example               # secrets template
├── .gitignore
├── docker-compose.yml         # textbee + mongo + campaign-manager + caddy
├── Caddyfile                  # reverse proxy + SSL (routes /crm/* to campaign-manager)
├── deploy/
│   ├── setup-vps.sh           # VPS hardening + Docker install
│   └── first-deploy.sh        # first-run deployment
├── services/
│   └── campaign-manager/      # multi-tenant CRM service (Node + Express + Mongoose)
│       ├── index.js
│       ├── src/
│       │   ├── routes/        # auth, clients, contacts, campaigns, webhooks
│       │   ├── models/        # Client, Contact, Campaign
│       │   ├── middleware/    # JWT auth
│       │   └── services/      # textbee adapter, scheduler
│       ├── package.json
│       ├── Dockerfile
│       └── README.md
├── infra/
│   ├── firebase-setup.md      # Firebase project walkthrough
│   └── firebase-credentials.json  # (gitignored) FCM creds
├── runbook/
│   └── FRIEND-RUNBOOK.md      # 1-page runbook for friend
├── textbee/                   # clone of github.com/vernu/textbee
└── docs/
    ├── ARCHITECTURE.md        # system architecture
    ├── ECONOMICS.md           # cost analysis + pricing
    └── PHASES.md              # project phase tracker
```

## Phases
- [x] Phase 1 — textbee foundation (single phone, end-to-end)
- [ ] Phase 2 — playSMS + bridge (multi-client)
- [ ] Phase 3 — friend-site hardware kit (3 phones, watchdog)
- [ ] Phase 4 — economics validation
- [ ] Phase 5 — multi-channel expansion (Telegram, WhatsApp, Viber, Line, Zalo)

## Useful commands
```bash
docker compose ps              # service status
docker compose logs -f api     # tail API logs
docker compose restart api     # restart API after .env change
```

## Links
- textbee: https://github.com/vernu/textbee
- playSMS: https://github.com/pedrofl/playSMS
- Caddy: https://caddyserver.com
