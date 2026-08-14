# Campaign Manager

Multi-tenant SMS campaign management service for the Simble platform.

Sits between clients (web users) and textbee (SMS gateway). Handles per-client accounts, contact lists, campaigns, quotas, throttled sending, and delivery report ingestion.

## Stack
- Node.js 20 + Express 4
- MongoDB (via mongoose 8)
- JWT auth (30-day tokens)
- Talks to textbee REST API for actual SMS sending

## Endpoints

### Public
- `GET  /health` — health probe
- `POST /api/auth/signup` — create client account
- `POST /api/auth/login` — login
- `POST /api/auth/promote-admin` — first-call bootstrap to create the admin
- `POST /api/webhooks/textbee` — textbee delivery reports

### Authenticated (Bearer token)
- `GET  /api/clients/me` — own profile
- `PATCH /api/clients/me` — update name
- `GET  /api/clients` — list all clients (admin only)
- `PATCH /api/clients/:id` — update plan/device/limits (admin only)
- `GET  /api/contacts?page=&limit=&q=` — list contacts
- `POST /api/contacts` — add one
- `POST /api/contacts/bulk` — CSV import (body: `{ csv: "..." }`)
- `DELETE /api/contacts/:id`
- `GET  /api/campaigns` — list own campaigns
- `POST /api/campaigns` — create (body: name, message, contactIds, scheduledAt?, throttleMs?)
- `GET  /api/campaigns/:id` — campaign with messages
- `POST /api/campaigns/:id/send` — start sending
- `POST /api/campaigns/:id/cancel` — cancel a running campaign

## Data model
- `Client` — user account, plan, device binding, monthly SMS quota
- `Contact` — per-client phone + custom fields, unique per (client, phone)
- `Campaign` — message, list of contact-bound `Message` subdocs, status, stats

## Sending flow
1. Client uploads contacts (CSV or one-by-one)
2. Client creates a campaign (selects contacts, writes message)
3. Client hits `/send` — server checks quota, runs `runCampaign` async
4. `runCampaign` iterates messages, throttles by `throttleMs` (default 2s), calls textbee
5. textbee pushes the SMS through the Android app via FCM
6. Android app delivers the SMS via the carrier
7. textbee POSTs delivery report to `/api/webhooks/textbee` → updates message status

## Run locally
```bash
cd services/campaign-manager
cp .env.example .env
# edit .env, then from project root:
docker compose up -d campaign-manager
```

## Tests
```bash
npm test
```

## Phase 5: multi-channel
This service will grow channel adapters (Telegram, WhatsApp, Viber, Line, Zalo) under `src/channels/`. The `Campaign.channel` field already supports that. Each adapter implements the same minimal interface as `src/services/textbee.js`.
