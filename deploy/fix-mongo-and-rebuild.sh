#!/usr/bin/env bash
set -euo pipefail

cd /root/simble

# Fix sms-relay MONGODB_URI: mongo -> mongodb
sed -i 's|mongodb://mongo:27017|mongodb://mongodb:27017|' services/sms-relay/.env
echo "--- sms-relay .env ---"
grep MONGODB_URI services/sms-relay/.env

# Rebuild campaign-manager (picks up the new textbee.js with SMS_GATEWAY_MOCK)
echo "--- rebuilding campaign-manager ---"
nohup docker compose build campaign-manager > /tmp/cm-rebuild.log 2>&1 &
BUILD_PID=$!
echo "build PID: $BUILD_PID"

# While building, also restart sms-relay so it picks up the new MONGODB_URI
echo "--- restarting sms-relay ---"
docker compose up -d --force-recreate sms-relay 2>&1 | tail -3

# Wait for build
echo "--- waiting for campaign-manager build ---"
wait $BUILD_PID 2>/dev/null || true
tail -3 /tmp/cm-rebuild.log

# Restart campaign-manager with new image
echo "--- restarting campaign-manager ---"
docker compose up -d --force-recreate campaign-manager 2>&1 | tail -3

echo "--- waiting 20s ---"
sleep 20

echo ""
echo "--- status ---"
docker compose ps

echo ""
echo "--- sms-relay logs ---"
docker compose logs --tail=10 sms-relay
echo ""
echo "--- campaign-manager logs ---"
docker compose logs --tail=10 campaign-manager
