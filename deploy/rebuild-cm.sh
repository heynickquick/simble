#!/usr/bin/env bash
set -euo pipefail
cd /root/simble
echo "--- pull latest ---"
git pull --ff-only 2>&1 | tail -3
echo "--- build campaign-manager ---"
docker compose build campaign-manager 2>&1 | tail -5
echo "--- restart campaign-manager ---"
docker compose up -d --force-recreate campaign-manager 2>&1 | tail -3
echo "--- waiting 15s ---"
sleep 15
echo "--- status ---"
docker compose ps
echo "--- logs ---"
docker compose logs --tail=15 campaign-manager
