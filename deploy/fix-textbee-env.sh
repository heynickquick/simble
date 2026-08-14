#!/usr/bin/env bash
set -euo pipefail

# Patch the root .env to include textbee's expected variable names,
# so textbee-api and textbee-web can boot.

cd ~/simble
. ./.env

# Add textbee-style env vars if not present
if ! grep -q '^MONGO_URI=' .env; then
  echo "" >> .env
  echo "# Textbee-specific env vars (added by fix-textbee-env.sh)" >> .env
  echo "MONGO_URI=mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongodb:27017/${MONGO_DATABASE}?authSource=admin" >> .env
  echo "MONGO_ROOT_USER=${MONGO_ROOT_USERNAME}" >> .env
  echo "MONGO_ROOT_PASS=${MONGO_ROOT_PASSWORD}" >> .env
  echo "FRONTEND_URL=https://sms.${DOMAIN}" >> .env
  echo "JWT_EXPIRATION=60d" >> .env
  # Cloudflare Turnstile test key (safe to use; not for production)
  echo "CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA" >> .env
  # Webhook delivery target
  echo "SIMBLE_WEBHOOK_URL=https://${DOMAIN}/api/webhooks/textbee" >> .env
fi

echo "--- updated .env (textbee section) ---"
grep -E '^(MONGO_URI|MONGO_ROOT_USER|MONGO_ROOT_PASS|FRONTEND_URL|CLOUDFLARE|SIMBLE_WEBHOOK)' .env

echo "--- recreating textbee-api ---"
docker compose up -d --force-recreate textbee-api 2>&1 | tail -10

echo "--- waiting 15s ---"
sleep 15

echo "--- logs ---"
docker compose logs --tail=25 textbee-api
