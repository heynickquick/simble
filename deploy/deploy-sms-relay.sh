#!/usr/bin/env bash
set -euo pipefail

# Idempotent: deploy sms-relay, swap campaign-manager to it, drop textbee.
# Requires the VPS to have:
#   - textbee-api and textbee-web removed (we'll do that)
#   - sms-relay service added
#   - campaign-manager .env updated to point at sms-relay
#   - nginx vhost for simble.unscale.cloud updated to route /devices and /messages to host:4010

cd /root/simble
git pull --ff-only 2>&1 | tail -3

# Generate a shared secret if not present
SECRET=$(openssl rand -hex 32)
if ! grep -q '^SMS_RELAY_SECRET=' services/sms-relay/.env 2>/dev/null; then
  if [ -f services/sms-relay/.env ]; then
    echo "SMS_RELAY_SECRET=${SECRET}" >> services/sms-relay/.env
  else
    cp services/sms-relay/.env.example services/sms-relay/.env
    sed -i "s|^SMS_RELAY_SECRET=.*|SMS_RELAY_SECRET=${SECRET}|" services/sms-relay/.env
  fi
  echo "--- generated new SMS_RELAY_SECRET ---"
fi

# Update campaign-manager .env to use sms-relay
ENV_FILE=services/campaign-manager/.env
if [ -f "$ENV_FILE" ]; then
  # Set/replace SMS_RELAY_URL and SMS_RELAY_SECRET
  if grep -q '^SMS_RELAY_URL=' "$ENV_FILE"; then
    sed -i 's|^SMS_RELAY_URL=.*|SMS_RELAY_URL=http://sms-relay:4010|' "$ENV_FILE"
  else
    echo "SMS_RELAY_URL=http://sms-relay:4010" >> "$ENV_FILE"
  fi
  if grep -q '^SMS_RELAY_SECRET=' "$ENV_FILE"; then
    sed -i "s|^SMS_RELAY_SECRET=.*|SMS_RELAY_SECRET=${SECRET}|" "$ENV_FILE"
  else
    echo "SMS_RELAY_SECRET=${SECRET}" >> "$ENV_FILE"
  fi
  # Drop textbee vars
  sed -i '/^TEXTBEE_/d' "$ENV_FILE" || true
  # Drop old mock var
  sed -i '/^TEXTBEE_MOCK=/d' "$ENV_FILE" || true
  sed -i 's|^SMS_GATEWAY_MOCK=.*|SMS_GATEWAY_MOCK=false|' "$ENV_FILE" || true
fi

echo "--- sms-relay .env (relevant) ---"
grep -E '^(MONGODB|SMS_RELAY)' services/sms-relay/.env
echo "--- campaign-manager .env (relevant) ---"
grep -E '^(SMS_|TEXTBEE_)' "$ENV_FILE" || echo "(none)"

# Stop and remove textbee containers
echo "--- stopping textbee containers ---"
docker compose stop textbee-api textbee-web 2>&1 | tail -3 || true
docker compose rm -f textbee-api textbee-web 2>&1 | tail -3 || true

# Build and start sms-relay
echo "--- building sms-relay ---"
nohup docker compose build sms-relay > /tmp/sms-relay-build.log 2>&1 &
BUILD_PID=$!
echo "build PID: $BUILD_PID"

# Update nginx vhost to route /devices and /messages to sms-relay (host:4010)
# AND add a vhost for /devices on simble.unscale.cloud
# (We keep the textbee vhost for now in case someone needs it)

VHOST=/etc/nginx/sites-enabled/simble.unscale.cloud
# Check if /devices and /messages routes already exist
if ! grep -q 'location /devices' "$VHOST"; then
  echo "--- patching simble.unscale.cloud vhost with /devices + /messages routes ---"
  python3 <<'EOF'
import re
path = '/etc/nginx/sites-enabled/simble.unscale.cloud'
with open(path) as f:
    src = f.read()
# Insert new locations before the final closing brace of the HTTPS server block
new_locations = """
    # sms-relay (Simble's own gateway, no Firebase)
    location ~ ^/(devices|messages)(/|$) {
        proxy_pass http://127.0.0.1:4010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""
# Find the first server block's closing brace and insert before it
# Simplistic: find "location /api/" and insert after the matching closing brace
# Better: insert right before the "ssl_dhparam" line
src = src.replace('    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;', new_locations + '    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;', 1)
with open(path, 'w') as f:
    f.write(src)
print('patched vhost')
EOF
  nginx -t 2>&1
  systemctl reload nginx
fi

# Wait for build
echo "--- waiting for sms-relay build ---"
wait $BUILD_PID 2>/dev/null || true
tail -5 /tmp/sms-relay-build.log

# Start sms-relay and restart campaign-manager
echo "--- bringing up sms-relay + restarting campaign-manager ---"
docker compose up -d sms-relay 2>&1 | tail -5
docker compose up -d --force-recreate campaign-manager 2>&1 | tail -5

echo "--- waiting 20s ---"
sleep 20

echo "--- status ---"
docker compose ps

echo "--- logs (sms-relay) ---"
docker compose logs --tail=15 sms-relay
echo "--- logs (campaign-manager) ---"
docker compose logs --tail=15 campaign-manager

echo ""
echo "============================================"
echo "  sms-relay deployed"
echo "============================================"
echo ""
echo "Test from anywhere:"
echo "  curl https://simble.unscale.cloud/health  (campaign-manager)"
echo ""
echo "Register a device:"
echo "  curl -X POST https://simble.unscale.cloud/devices \\"
echo "    -H 'Authorization: Bearer ${SECRET}' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"My Phone\"}'"
echo ""
echo "Use the returned 'token' as DEVICE_TOKEN on the phone agent."
