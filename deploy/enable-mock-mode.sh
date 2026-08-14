#!/usr/bin/env bash
set -euo pipefail

cd ~/simble
git pull --ff-only 2>&1 | tail -3

# Patch campaign-manager .env to enable mock mode
ENV_FILE=services/campaign-manager/.env
if ! grep -q '^TEXTBEE_MOCK=' "$ENV_FILE"; then
  echo "TEXTBEE_MOCK=true" >> "$ENV_FILE"
else
  sed -i 's|^TEXTBEE_MOCK=.*|TEXTBEE_MOCK=true|' "$ENV_FILE"
fi

# Set webhook URL
if ! grep -q '^SIMBLE_WEBHOOK_URL=' "$ENV_FILE"; then
  echo "SIMBLE_WEBHOOK_URL=https://simble.unscale.cloud/api/webhooks/textbee" >> "$ENV_FILE"
else
  sed -i 's|^SIMBLE_WEBHOOK_URL=.*|SIMBLE_WEBHOOK_URL=https://simble.unscale.cloud/api/webhooks/textbee|' "$ENV_FILE"
fi

echo "--- campaign-manager .env (relevant) ---"
grep -E '^(TEXTBEE_|SIMBLE_)' "$ENV_FILE"

echo "--- rebuilding + restarting campaign-manager ---"
docker compose up -d --build --force-recreate campaign-manager 2>&1 | tail -10

echo "--- waiting 15s ---"
sleep 15

echo "--- logs ---"
docker compose logs --tail=20 campaign-manager

echo "--- health ---"
docker compose exec -T campaign-manager wget -qO- http://localhost:4000/health
