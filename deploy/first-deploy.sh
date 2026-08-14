#!/usr/bin/env bash
set -euo pipefail

# First-time deploy of msg-platform
# Assumes: VPS is hardened, this repo + textbee subdir are cloned, .env is filled in

REPO_DIR="${REPO_DIR:-$HOME/msg-platform}"
cd "$REPO_DIR"

echo "==> Validating .env"
if [[ ! -f .env ]]; then
    echo "ERROR: .env not found. Copy .env.example to .env and fill in values."
    exit 1
fi

required_vars=("DOMAIN" "MONGO_ROOT_PASSWORD" "JWT_SECRET" "FIREBASE_PROJECT_ID")
missing=0
for v in "${required_vars[@]}"; do
    if ! grep -qE "^${v}=.+" .env; then
        echo "ERROR: .env is missing or empty: $v"
        missing=1
    fi
done
[[ $missing -eq 1 ]] && exit 1

echo "==> Cloning textbee (if not already present)"
if [[ ! -d textbee ]]; then
    git clone --depth 1 https://github.com/vernu/textbee.git textbee
else
    echo "    textbee/ already exists, skipping clone"
fi

echo "==> Pulling base images"
docker compose pull caddy mongodb

echo "==> Building textbee api and web"
docker compose build api web

echo "==> Starting services"
docker compose up -d

echo "==> Waiting 20s for services to come up..."
sleep 20

echo "==> Health check"
if docker compose exec -T api wget -q -O- http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "OK: API responding internally"
else
    echo "WARNING: API not responding yet. Check logs: docker compose logs -f api"
fi

DOMAIN_VALUE=$(grep '^DOMAIN=' .env | cut -d= -f2)
echo ""
echo "============================================"
echo "  Deploy complete"
echo "============================================"
echo ""
echo "Make sure DNS A record for $DOMAIN_VALUE points to this VPS IP."
echo "Caddy will auto-issue a Let's Encrypt cert on first request."
echo ""
echo "Dashboard: https://$DOMAIN_VALUE"
echo "First user to sign up becomes admin."
echo ""
echo "Useful commands:"
echo "  cd $REPO_DIR"
echo "  docker compose ps              # service status"
echo "  docker compose logs -f         # tail all logs"
echo "  docker compose logs -f api     # tail API logs"
echo "  docker compose restart api     # restart API after .env change"
