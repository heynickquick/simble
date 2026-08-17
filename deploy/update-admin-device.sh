#!/usr/bin/env bash
set -euo pipefail
cd /root/simble

PW=$(grep '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2)
DEVICE_TOKEN="sim_f08e706df4e7ca0893fbb99978a48acfa556a4381f511c25"

docker compose exec -T mongodb mongosh "mongodb://admin:${PW}@mongodb:27017/simble?authSource=admin" --eval "
db.clients.updateOne(
  {email: 'nick@simble.example'},
  {\$set: {deviceId: '$DEVICE_TOKEN'}}
);
print('--- updated admin deviceId ---');
print(JSON.stringify(db.clients.findOne({email:'nick@simble.example'}, {deviceId: 1, _id: 0})));
"

