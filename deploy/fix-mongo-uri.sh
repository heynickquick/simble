#!/usr/bin/env bash
set -euo pipefail

cd ~/simble
PW=$(grep '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2)
NEW_URI="mongodb://admin:${PW}@mongodb:27017/simble?authSource=admin"

# Overwrite campaign-manager .env MONGODB_URI line
python3 - <<EOF
import re
path = 'services/campaign-manager/.env'
with open(path) as f:
    lines = f.readlines()
with open(path, 'w') as f:
    for line in lines:
        if line.startswith('MONGODB_URI='):
            f.write('MONGODB_URI=' + '${NEW_URI}' + '\n')
        else:
            f.write(line)
print('updated')
EOF

echo "--- new MONGODB_URI ---"
grep MONGODB_URI services/campaign-manager/.env
echo "--- recreating campaign-manager ---"
docker compose up -d --force-recreate campaign-manager
echo "--- waiting 15s ---"
sleep 15
echo "--- status ---"
docker compose ps
echo "--- logs ---"
docker compose logs --tail=15 campaign-manager
echo "--- health ---"
docker compose exec -T campaign-manager wget -qO- http://localhost:4000/health 2>&1 || echo "still not up"
