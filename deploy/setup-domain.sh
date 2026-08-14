#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-simble.unscale.cloud}"
VPS_IP="72.60.63.202"

cd ~/simble

echo "=== Updating DOMAIN in root .env to $DOMAIN ==="
sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
grep '^DOMAIN=' .env

echo "=== Bringing up Caddy (will issue Let's Encrypt cert once DNS resolves) ==="
# Ensure the env file has the domain too
if ! grep -q '^DOMAIN=' .env; then
  echo "DOMAIN=${DOMAIN}" >> .env
fi

docker compose up -d --build caddy 2>&1 | tail -15

echo ""
echo "=== Waiting 10s for Caddy to start ==="
sleep 10

echo "=== Caddy logs ==="
docker compose logs --tail=20 caddy

echo ""
echo "=== Testing localhost:80 (Caddy should respond) ==="
curl -sS -o /dev/null -w "HTTP %{http_code} (size %{size_download})\n" http://localhost/ 2>&1 || echo "no response"

echo ""
echo "=== Done ==="
echo "Domain set to: ${DOMAIN}"
echo "VPS IP: ${VPS_IP}"
echo "Test from VPS now: curl -I http://${DOMAIN} (will fail until DNS propagates)"
echo "After DNS propagates: Caddy will auto-issue Let's Encrypt cert"
echo "Then: curl -I https://${DOMAIN} will return 200 with valid cert"
