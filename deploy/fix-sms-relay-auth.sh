#!/usr/bin/env bash
set -euo pipefail
cd /root/simble

# Add mongo auth to sms-relay MONGODB_URI
PW=$(grep '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2)
ENV=services/sms-relay/.env
sed -i "s|mongodb://mongodb:27017|mongodb://admin:${PW}@mongodb:27017|" "$ENV"
sed -i 's|simble_relay$|simble_relay?authSource=admin|' "$ENV"
echo "--- sms-relay .env ---"
grep MONGODB_URI "$ENV"

# Restart
docker compose up -d --force-recreate sms-relay 2>&1 | tail -3
sleep 10
echo "--- status ---"
docker compose ps
echo "--- logs ---"
docker compose logs --tail=10 sms-relay
