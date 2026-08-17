#!/usr/bin/env bash
set -euo pipefail

# Patch textbee-api to make Firebase initialization optional.
# Without this, the API crashes at boot if FIREBASE_PROJECT_ID isn't set.
# After this patch, the API starts in "degraded" mode (no FCM push, but REST API + QR codes work).

cd /root/simble
MAIN=textbee/api/src/main.ts

if grep -q '// PATCH: firebase optional' "$MAIN"; then
  echo "Already patched, skipping"
  exit 0
fi

# Insert a try/catch around the firebase.initializeApp call
# The original code is:
#   firebase.initializeApp({
#     credential: firebase.credential.cert(firebaseConfig),
#   })
# We wrap it.

python3 <<'EOF'
import re
path = '/root/simble/textbee/api/src/main.ts'
with open(path) as f:
    src = f.read()

old = """  firebase.initializeApp({
    credential: firebase.credential.cert(firebaseConfig),
  })"""

new = """  // PATCH: firebase optional
  try {
    if (firebaseConfig.projectId) {
      firebase.initializeApp({
        credential: firebase.credential.cert(firebaseConfig),
      })
      logger.log('Firebase initialized')
    } else {
      logger.warn('FIREBASE_PROJECT_ID not set — running without FCM (degraded mode). QR pairing + REST API work; phone push commands will not work until Firebase is configured.')
    }
  } catch (e) {
    logger.error('Firebase init failed, continuing without FCM:', e.message)
  }"""

if old not in src:
    print('ERROR: original block not found in main.ts')
    print('--- first 5 lines containing firebase ---')
    for line in src.split('\n'):
        if 'firebase' in line.lower():
            print(line)
    raise SystemExit(1)

src = src.replace(old, new)
with open(path, 'w') as f:
    f.write(src)
print('patched')
EOF

echo "--- patched main.ts (firebase section) ---"
grep -A 15 'PATCH: firebase optional' "$MAIN" || true

echo "--- rebuild + restart textbee-api ---"
docker compose up -d --build --force-recreate textbee-api 2>&1 | tail -15

echo "--- waiting 20s ---"
sleep 20

echo "--- logs ---"
docker compose logs --tail=30 textbee-api

echo "--- testing health endpoints ---"
docker compose exec -T textbee-api wget -qO- http://localhost:3000/-json 2>&1 | head -3 || echo "api not responding"
