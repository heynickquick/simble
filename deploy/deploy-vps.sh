#!/usr/bin/env bash
set -euo pipefail

cd ~/simble
echo "--- pulling latest ---"
git pull --ff-only 2>&1 | tail -3

echo "--- ensuring .env files ---"
[ -f services/campaign-manager/.env ] || cp services/campaign-manager/.env.example services/campaign-manager/.env
[ -f services/watchdog/.env ] || cp services/watchdog/.env.example services/watchdog/.env

# Patch textbee URL/key in campaign-manager if still placeholder
if grep -q "TEXTBEE_API_KEY=placeholder" services/campaign-manager/.env; then
  sed -i 's|TEXTBEE_API_URL=.*|TEXTBEE_API_URL=http://textbee-api:3000|' services/campaign-manager/.env
  sed -i 's|TEXTBEE_API_KEY=.*|TEXTBEE_API_KEY=placeholder_will_fail_until_textbee_set_up|' services/campaign-manager/.env
fi

# Patch watchdog env
sed -i 's|TEXTBEE_API_URL=.*|TEXTBEE_API_URL=http://textbee-api:3000|' services/watchdog/.env
sed -i 's|TEXTBEE_API_KEY=.*|TEXTBEE_API_KEY=placeholder|' services/watchdog/.env
sed -i 's|DEVICE_IDS=.*|DEVICE_IDS=placeholder|' services/watchdog/.env

echo "--- building and starting new services ---"
docker compose up -d --build web watchdog

echo "--- waiting 15s ---"
sleep 15

echo "--- status ---"
docker compose ps

echo "--- web logs ---"
docker compose logs --tail=15 web

echo "--- watchdog logs ---"
docker compose logs --tail=15 watchdog

echo "--- web health (from inside container) ---"
docker compose exec -T web wget -qO- http://localhost:8080/ 2>&1 | head -5 || echo "web not up"
