#!/usr/bin/env bash
set -euo pipefail

cd ~/simble
cp -n .env.example .env
cp -n services/campaign-manager/.env.example services/campaign-manager/.env

# Generate secrets
MONGO_PW=$(openssl rand -hex 16)
JWT=$(openssl rand -hex 32)

# Update root .env
sed -i "s|DOMAIN=.*|DOMAIN=placeholder.simble.example|" .env
sed -i "s|MONGO_ROOT_PASSWORD=.*|MONGO_ROOT_PASSWORD=${MONGO_PW}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env

# Update campaign-manager .env
CM_ENV=services/campaign-manager/.env
sed -i "s|MONGODB_URI=.*|MONGODB_URI=mongodb://admin:${MONGO_PW}@mongo:27017/simble?authSource=admin|" "$CM_ENV"
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT}|" "$CM_ENV"
sed -i "s|TEXTBEE_API_URL=.*|TEXTBEE_API_URL=http://textbee:3000|" "$CM_ENV"
sed -i "s|TEXTBEE_API_KEY=.*|TEXTBEE_API_KEY=placeholder_will_fail_until_textbee_set_up|" "$CM_ENV"

echo "--- root .env ---"
grep -E '^(DOMAIN|MONGO_ROOT_PASSWORD|JWT_SECRET)=' .env
echo "--- campaign-manager .env ---"
grep -E '^(MONGODB_URI|JWT_SECRET|TEXTBEE_)' "$CM_ENV"

echo "--- starting mongo + campaign-manager ---"
docker compose up -d mongodb campaign-manager
echo "--- waiting 20s for startup ---"
sleep 20
docker compose ps
echo "--- health checks ---"
docker compose exec -T campaign-manager wget -qO- http://localhost:4000/health 2>&1 || echo "campaign-manager not yet up"
