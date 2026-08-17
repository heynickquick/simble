# Simble — Handoff Document

> **⚠️ Out of date for Phase 1+.** This doc was written when Simble used `textbee` + Firebase. We've since replaced textbee with our own `sms-relay` + native Kotlin Android app (no FCM, no third-party code). For the current architecture, see `docs/ARCHITECTURE.md`. For what's done vs pending, see `docs/PHASES.md`. This doc is kept for historical context only.

**Read this first if you're picking up development on Simble.**

## What is Simble?

A self-hosted mobile messaging marketing platform. Sends SMS (and eventually WhatsApp/Telegram/Viber/Line/Zalo) from the operator's own Android phones + SIM cards, bypassing Twilio/A2P per-message fees. Multi-tenant CRM on top, so the operator can resell as an agency.

**Brand:** Simble (SIM + nimble). A short, verb-able name ("Send a Simble"). Domain: `simble.unscale.cloud`.

## Who runs it?

**Nick Quick** — based in Asuncion, Paraguay. Hardware (Android phones with Tello/Mint SIMs) lives at a friend's house in the USA. Nick manages everything from Paraguay via web UI. The phones are plugged in 24/7 at the friend's place and the VPS orchestrates them.

## Architecture (deployed on VPS)

```
Asuncion, PY (Nick, browser) ──HTTPS──> simble.unscale.cloud (nginx, SSL via certbot)
                                              │
                                              ├── /api/* ──> campaign-manager :4000 (Node/Express/Mongo)
                                              └── /        ──> web :8080 (Vue 3 SPA, served by nginx)
                                              │
                                              └── HTTPS ──> sms.simble.unscale.cloud
                                                            │
                                                            ├── /api/* ──> textbee-api :3000 (DOWN — needs Firebase)
                                                            └── /        ──> textbee-web :3000 (Next.js, UP)

VPS (Hostinger KVM 4, 72.60.63.202, Ubuntu 24.04):
  ├─ MongoDB 7 (campaign-manager + textbee share via separate DBs)
  ├─ campaign-manager (port 4000) — multi-tenant CRM, JWT auth, throttled send, mock mode
  ├─ web (port 8880→8080) — login, dashboard, contacts, campaigns, settings
  ├─ textbee-web (port 3000) — textbee dashboard, but API below is down
  ├─ watchdog — polls textbee device status, alerts via Telegram (configured for placeholder)
  └─ (other unrelated services: open-seo, karakeep, freshrss, n8n, reachinbox, ladder)

Friend's house, USA (not yet deployed):
  └─ 2-3 spare Android phones with Tello/Mint SIM, textbee app, charging 24/7
```

## What works RIGHT NOW (live, public URLs)

| URL | Status | What |
|---|---|---|
| `https://simble.unscale.cloud/` | ✅ 200 OK | Simble web UI — login/dashboard/contacts/campaigns |
| `https://simble.unscale.cloud/api/*` | ✅ 200 OK | campaign-manager REST API |
| `https://sms.simble.unscale.cloud/` | ✅ 200 OK | textbee web dashboard (UI loads, but API behind it is down) |
| `https://sms.simble.unscale.cloud/api/*` | ❌ DOWN | textbee-api (crashes without Firebase) |

**Admin login (created during smoke test):**
- Email: `nick@simble.example`
- Password: `testpass123`
- (Change this before going to production.)

**Try the full mock-mode flow:**
1. Open `https://simble.unscale.cloud`
2. Log in with the admin above
3. Contacts tab → Import CSV → paste `phone,firstName,lastName\n+15551234567,Alice,Test\n+15559876543,Bob,Test`
4. Campaigns tab → New campaign → pick contacts → write a message → Create & send
5. Within 3-5 seconds, status flips to `delivered` (mock-simulated webhook)

## What's the immediate blocker?

**Firebase.** textbee-api can't start without Firebase credentials because it uses FCM (Firebase Cloud Messaging) to push "send this SMS" commands to the Android app. Without it, the API crashes at boot with:

```
FirebaseAppError: Service account object must contain a string "project_id" property.
```

Firebase is the only thing standing between us and end-to-end real SMS sending. **This is the first thing to fix.**

## Firebase setup — step by step

Estimated time: 10-15 minutes if you have browser automation. You (Kimi) have browser access, so you can do this yourself.

### 1. Create the Firebase project
- Go to https://console.firebase.google.com (sign in with Nick's Google account — `nick@nickquick.co`)
- Click "Add project" → name it `simble-prod` → disable Google Analytics → Create project

### 2. Enable Cloud Messaging
- In the new project, click the gear icon → Project settings
- Go to the "Cloud Messaging" tab
- Note the **Project ID** and **Sender ID** (you'll need these)

### 3. Create a service account
- Same Project settings page → "Service accounts" tab
- Click "Generate new private key" → a JSON file downloads
- Open it and extract:
  - `project_id`
  - `client_email`
  - `private_key` (keep the `\n` escape sequences when pasting into .env)

### 4. Add the env vars to the VPS
- SSH to VPS: `ssh cwai`
- Edit the root .env: `nano /root/simble/.env`
- Fill in:
  ```
  FIREBASE_PROJECT_ID=<project_id from step 2>
  FIREBASE_CLIENT_EMAIL=<client_email from JSON>
  FIREBASE_PRIVATE_KEY="<private_key from JSON, with \n escapes>"
  ```
- Also need to add (from the JSON):
  - `FIREBASE_PRIVATE_KEY_ID`
  - `FIREBASE_CLIENT_ID`
  - `FIREBASE_CLIENT_C509_CERT_URL`
- Save the JSON as `/root/simble/infra/firebase-credentials.json` too (for reference)

### 5. Register an Android app in Firebase
- Back in Firebase console → Project settings → "Your apps" → "Add app" → Android
- Package name: `dev.textbee.android` (this must match the textbee Android app's package name)
- Download `google-services.json`
- Place it at `/root/simble/textbee/android/app/google-services.json`
- Rebuild textbee-android: `cd /root/simble/textbee/android && ./gradlew assembleRelease` (this requires Java/Android SDK on the VPS — if not available, we'll need to do this elsewhere or use a pre-built APK)
- The result is an APK at `app/build/outputs/apk/release/app-release.apk`

### 6. Restart textbee-api
```bash
ssh cwai 'cd /root/simble && docker compose up -d --force-recreate textbee-api'
docker compose logs -f textbee-api  # should now show "listening on :3000"
```

### 7. Pair the phone
- Open `https://sms.simble.unscale.cloud` in a browser
- Sign up for an account
- Settings → Devices → "Register device" → generates a QR code
- Install the textbee Android app (APK from step 5) on the phone
- Open app → Scan QR
- Phone shows as "online" in dashboard
- Send a test SMS via the API

## Repository

- **GitHub**: https://github.com/heynickquick/simble
- **Local path (Nick's Windows)**: `C:\Users\Nick\projects\simble\`
- **VPS path**: `/root/simble/`
- **Branch**: `master`

## Deploy workflow

```powershell
# From Nick's Windows machine
cd C:\Users\Nick\projects\simble
git add . ; git commit -m "..." ; git push
```

```bash
# On the VPS
ssh cwai
cd /root/simble
git pull
docker compose up -d --build
```

## File structure

```
simble/
├── AGENTS.md                      # project memory (read this too)
├── HANDOFF.md                     # this file
├── README.md                      # quickstart
├── .env.example                   # secrets template
├── .gitattributes                 # LF line endings on .sh, .yml, etc.
├── .gitignore
├── docker-compose.yml             # textbee-api, textbee-web, mongodb, campaign-manager, web, watchdog
├── Caddyfile                      # unused (we use system nginx + certbot instead)
├── package.json                   # (not used — services are self-contained)
├── deploy/                        # VPS-side deployment scripts
│   ├── setup-vps.sh               # harden VPS, create deploy user (already run)
│   ├── setup-nginx.sh             # create vhost for simble.unscale.cloud (already run)
│   ├── setup-domain.sh            # configure DOMAIN env + bring up caddy
│   ├── enable-mock-mode.sh        # turn on TEXTBEE_MOCK in campaign-manager
│   ├── fix-textbee-env.sh         # patch .env for textbee's expected var names
│   ├── fix-mongo-uri.sh           # fix mongo service hostname (mongo→mongodb)
│   ├── bootstrap-vps.sh           # full first-time VPS setup
│   ├── smoke-test.js              # Node script to validate all 8 API endpoints
│   └── e2e-mock-test.js           # Node script to validate full send/deliver flow in mock mode
├── services/
│   ├── campaign-manager/          # THE multi-tenant CRM
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   ├── README.md
│   │   ├── index.js               # Express app, mounts routes, scheduled tick
│   │   └── src/
│   │       ├── models/
│   │       │   ├── Client.js      # user account, plan, device binding, monthly quota
│   │       │   ├── Contact.js     # per-client phone + custom fields
│   │       │   └── Campaign.js    # message, messages[], status, stats
│   │       ├── routes/
│   │       │   ├── auth.js        # signup, login, promote-admin (one-time)
│   │       │   ├── clients.js     # profile, admin user mgmt
│   │       │   ├── contacts.js    # list, add, bulk CSV import
│   │       │   ├── campaigns.js   # CRUD, send, cancel
│   │       │   └── webhooks.js    # textbee delivery report receiver
│   │       ├── middleware/
│   │       │   └── auth.js        # JWT verification
│   │       └── services/
│   │           ├── textbee.js     # adapter: sendSms, getDeviceStatus. MOCK MODE SUPPORT.
│   │           └── scheduler.js   # throttled send loop, scheduled-campaign tick
│   └── watchdog/                  # textbee device health monitor
│       ├── package.json
│       ├── Dockerfile
│       ├── .env.example
│       ├── README.md
│       └── index.js               # polls devices, alerts via Telegram
├── web/                           # Simble web UI
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf                 # serves on 8080, falls back to index.html
│   ├── index.html                 # Vue 3 templates for login + app views
│   ├── app.js                     # Vue 3 setup, state, API calls
│   └── style.css
├── infra/
│   ├── firebase-setup.md          # doc
│   └── firebase-credentials.json  # (gitignored) when you get it
├── runbook/
│   └── FRIEND-RUNBOOK.md          # 1-page for the friend with the phones
├── textbee/                       # clone of github.com/vernu/textbee (just-cloned, not yet patched)
└── docs/
    ├── ARCHITECTURE.md            # system architecture
    ├── ECONOMICS.md               # cost analysis + pricing
    ├── HANDOFF.md                 # this file
    └── PHASES.md                  # project phase tracker
```

## The full API surface (campaign-manager)

All endpoints accept/return JSON. Auth via `Authorization: Bearer <token>` header (except where noted).

### Public
- `GET  /health` — health probe
- `POST /api/auth/signup` — `{name, email, password, deviceId}` → `{token, client}`
- `POST /api/auth/login` — `{email, password}` → `{token, client}`
- `POST /api/auth/promote-admin` — ONE-TIME bootstrap (only works if no admin exists yet)
- `POST /api/webhooks/textbee` — textbee delivery report webhook

### Authenticated
- `GET  /api/clients/me` — own profile
- `PATCH /api/clients/me` — update name
- `GET  /api/clients` — list all (admin only)
- `PATCH /api/clients/:id` — update plan/device/limits (admin only)
- `GET  /api/contacts?page=&limit=&q=` — list contacts
- `POST /api/contacts` — add one
- `POST /api/contacts/bulk` — CSV import (body: `{csv: "..."}`)
- `DELETE /api/contacts/:id`
- `GET  /api/campaigns` — list own campaigns
- `POST /api/campaigns` — create (body: name, message, contactIds, scheduledAt?, throttleMs?)
- `GET  /api/campaigns/:id` — campaign with messages
- `POST /api/campaigns/:id/send` — start sending
- `POST /api/campaigns/:id/cancel` — cancel a running campaign

## The conversation so far (chronological highlights)

1. **Research phase** — Identified textbee as the best Android SMS gateway (QR pairing, free, open source). Considered alternatives: httpSMS, SMS Gateway for Android, Somleng, Simble, SimGate, SelfHostedSMS. Picked textbee for closest-to-SendApp UX.

2. **Initial architecture** — textbee + playSMS bridge. Decided to **replace playSMS with our own campaign-manager** (Node/Express/Mongoose) because it would be ~600 LOC, fit the data model, and be a clean foundation for Phase 5 multi-channel.

3. **Picked brand** — "Simble" (SIM + nimble). Direct, verb-able, owns the SIM-based differentiation.

4. **Built the campaign-manager** — 16 files, full multi-tenant CRM with JWT auth, contact management, CSV import, campaign creation, throttled send, webhook receiver, scheduled-campaign tick.

5. **Provisioned VPS** — Confirmed Nick had Hostinger KVM 4 VPS at 72.60.63.202 with Docker already installed. SSH alias `cwai` works.

6. **Deployed** — Set up `deploy` user, brought up MongoDB + campaign-manager, ran smoke test (all 8 endpoints passed). Web UI built and deployed. Watchdog service built and deployed. Caddyfile removed in favor of system nginx + certbot.

7. **Configured domain** — `simble.unscale.cloud` DNS A record (added by Nick), certbot issued Let's Encrypt cert for both `simble.unscale.cloud` and `sms.simble.unscale.cloud`. Both live with HTTPS.

8. **Encountered blocker** — textbee-api crashes without Firebase. Stopped it to prevent crash-loop.

9. **Added TEXTBEE_MOCK mode** — Campaign-manager can now simulate SMS sends end-to-end (login → contact → campaign → send → delivery report in 3 seconds). All UI flows testable without real hardware.

10. **Discovered QR code question** — Nick realized he can't actually pair a phone without Firebase. This is the hand-off point.

## What's been DONE vs PENDING

### ✅ Done
- Architecture designed and committed to GitHub
- Campaign-manager: built, deployed, smoke-tested
- Web UI: built, deployed, accessible at https://simble.unscale.cloud
- Watchdog: built, deployed (waiting for real DEVICE_IDS + Telegram token)
- Mock mode: enabled, e2e test passes
- Domain + SSL: simble.unscale.cloud + sms.simble.unscale.cloud, Let's Encrypt certs
- VPS hardening: deploy user, UFW, fail2ban
- Documentation: AGENTS.md, README.md, ARCHITECTURE.md, ECONOMICS.md, PHASES.md, HANDOFF.md
- GitHub: https://github.com/heynickquick/simble (5 commits, all pushed)

### 🟡 Partial / Configured But Not Working
- textbee: source cloned on VPS, web UI up at sms.simble.unscale.cloud, but API is down
- Watchdog: running with placeholder DEVICE_IDS, Telegram alerts disabled (placeholder token)
- Caddyfile: not used (we're using system nginx instead)

### ❌ Blocked / Pending
- **textbee-api**: needs Firebase credentials (priority #1)
- **textbee-android APK**: needs Firebase project + Android app registered
- **Friend's house hardware**: 2-3 phones + Tello/Mint SIMs need to be shipped
- **Real SMS end-to-end test**: blocked on above
- **Stripe billing**: not started (Phase 4)
- **Telegram channel adapter**: not started (Phase 5)
- **Inbound SMS handler**: not started (webhook currently only handles delivery reports)
- **CSV export of campaign results**: not started

## Specific tasks for you (Kimi)

1. **[CRITICAL] Set up Firebase for textbee.** Walk through the steps in "Firebase setup" above. ~10-15 min. After this, the QR pairing works and real SMS can be sent.

2. **[if step 1 succeeds] Build the textbee Android APK with google-services.json embedded, install on Nick's phone, pair via QR, send a real SMS.** Validates end-to-end.

3. **[while waiting for Firebase] Wire the watchdog's real DEVICE_IDS + Telegram bot token.** Nick can create a Telegram bot in 2 min via @BotFather. Update `services/watchdog/.env` and restart.

4. **[optional] Migrate to Firebase-free SMS Gateway (capcom6/android-sms-gateway) if Firebase setup is blocked.** Less polished UX but no Firebase dependency. Probably not needed if step 1 succeeds.

5. **[Phase 5 first win] Build the Telegram channel adapter.** Free, no approval, validates the multi-channel architecture. ~150 LOC. Same flow as textbee adapter but uses Telegram Bot API.

## What NOT to do

- Don't change the existing campaign-manager API contracts without updating the web UI in lockstep
- Don't add a build step to the web UI (intentionally zero-build, Vue 3 from CDN)
- Don't introduce new database backends — MongoDB only
- Don't remove the mock mode — it's the only way to test without real hardware
- Don't change the VPS Docker compose names (`textbee-api`, `textbee-web`, `mongodb`, `campaign-manager`, `web`, `watchdog`) without also updating the system nginx vhost

## Quick verification commands

```bash
# Verify VPS is reachable
ssh cwai 'docker compose ps'

# Verify the web UI is up (from anywhere)
curl -I https://simble.unscale.cloud/

# Verify the API
curl https://simble.unscale.cloud/health
# → {"ok":true,"service":"campaign-manager","uptime":N}

# Verify the textbee subdomain
curl -I https://sms.simble.unscale.cloud/

# Pull latest
ssh cwai 'cd /root/simble && git pull && docker compose ps'

# View campaign-manager logs
ssh cwai 'cd /root/simble && docker compose logs --tail=50 -f campaign-manager'

# Run the e2e mock test
node C:\Users\Nick\projects\simble\deploy\e2e-mock-test.js
```

## Key insights / context

- **Why this design and not just playSMS / Twilio?** playSMS would have meant a separate PHP stack + custom gateway plugin + a user model that doesn't match multi-tenant SaaS. Twilio charges per-message. The 600-LOC campaign-manager + textbee combo is cheaper, faster, and a cleaner foundation for multi-channel.
- **Why consumer SIMs?** 1,000-3,000 SMS/mo per Tello/Mint line is essentially free beyond the SIM cost. Twilio would charge $0.0079/SMS + monthly number fees.
- **Why Paraguay → USA architecture?** Nick is in PY. US phones + US SIMs = highest deliverability for US recipients. Friend in USA hosts the hardware (Nick has no US address).
- **Why mock mode?** Lets us test the full pipeline (UI + API + throttling + webhook + stats) without a real phone. Critical for development velocity.
- **Why textbee specifically?** Closest to SendApp's QR-pair UX. Most popular open-source Android SMS gateway. Good docs. Active maintenance.

## If you get stuck

- VPS issues: `ssh cwai 'docker compose logs -f <service>'`
- API issues: check `/root/simble/services/campaign-manager/.env` for correct env vars
- DNS issues: `nslookup simble.unscale.cloud` should return 72.60.63.202
- Cert issues: `ssh cwai 'sudo certbot certificates'` to see all certs
- Mongo issues: `ssh cwai 'docker compose exec mongodb mongosh simble'` to inspect
- Need a fresh start: `ssh cwai 'cd /root/simble && git reset --hard && git pull && docker compose up -d --build'`

---

Welcome aboard. The hard architecture work is done. Now it's mostly: Firebase setup, real SMS test, then onward to Phase 5 (multi-channel) and Phase 4 (Stripe billing).

— Mavis (the agent that built this) handing off to Kimi
