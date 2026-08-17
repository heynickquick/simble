#!/usr/bin/env bash
set -euo pipefail
cd /root/simble

git pull --ff-only 2>&1 | tail -3

# Rebuild sms-relay (new qrcode dep)
nohup docker compose build sms-relay > /tmp/qr-build.log 2>&1 &
BUILD_PID=$!
echo "build PID: $BUILD_PID"

# While building, get a device token we can test with
DEVICE_TOKEN=$(curl -sS -X POST http://localhost:4010/devices \
  -H "Authorization: Bearer $(grep SMS_RELAY_SECRET services/sms-relay/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"name":"QR Test Device"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "test device token: $DEVICE_TOKEN"

# Wait for build
echo "--- waiting for build ---"
wait $BUILD_PID 2>/dev/null || true
tail -3 /tmp/qr-build.log

# Restart sms-relay
echo "--- restarting sms-relay ---"
docker compose up -d --force-recreate sms-relay 2>&1 | tail -3

sleep 10
echo "--- logs ---"
docker compose logs --tail=10 sms-relay

echo ""
echo "--- testing QR endpoint ---"
QR_STATUS=$(curl -sS -o /tmp/qr.html -w "%{http_code}" "http://localhost:4010/devices/${DEVICE_TOKEN}/qr?server=https://simble.unscale.cloud")
echo "QR endpoint status: $QR_STATUS"
echo "QR response size: $(wc -c < /tmp/qr.html) bytes"
head -20 /tmp/qr.html
