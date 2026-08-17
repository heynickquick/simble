#!/usr/bin/env bash
set -euo pipefail

cd /root/simble

# 1. Fix sms-relay MONGODB_URI (mongo -> mongodb, same as campaign-manager fix)
PW=$(grep '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2)
ENV=services/sms-relay/.env
if grep -q '@mongo:27017' "$ENV"; then
  sed -i "s|mongodb://mongo:27017|mongodb://mongodb:27017|" "$ENV"
  echo "--- fixed sms-relay MONGODB_URI ---"
  grep MONGODB_URI "$ENV"
fi

# 2. Fix campaign-manager env: TEXTBEE_MOCK -> SMS_GATEWAY_MOCK
ENV=services/campaign-manager/.env
if grep -q '^TEXTBEE_MOCK=' "$ENV"; then
  sed -i 's|^TEXTBEE_MOCK=.*|SMS_GATEWAY_MOCK=false|' "$ENV"
  echo "--- fixed campaign-manager env (TEXTBEE_MOCK -> SMS_GATEWAY_MOCK) ---"
  grep -E '^(SMS_|TEXTBEE_)' "$ENV"
fi

# 3. Stop orphan textbee containers (no longer in compose)
echo "--- stopping orphan textbee containers ---"
docker compose down --remove-orphans 2>&1 | tail -10 || true

# 4. Restart sms-relay and campaign-manager
echo "--- restarting services ---"
docker compose up -d --force-recreate sms-relay campaign-manager 2>&1 | tail -5

echo "--- waiting 20s ---"
sleep 20

echo "--- status ---"
docker compose ps

echo ""
echo "--- sms-relay logs ---"
docker compose logs --tail=15 sms-relay
echo ""
echo "--- campaign-manager logs ---"
docker compose logs --tail=10 campaign-manager
