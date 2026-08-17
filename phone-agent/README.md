# Simble Phone Agent

A small Node.js script that runs on the Android phone and sends SMS through Simble. **No third-party Android app, no FCM, no Play Store.**

## What it does

1. Polls the Simble sms-relay on the VPS every ~5s
2. When a queued SMS appears, sends it via Android's SMS API (through Termux:API)
3. Reports delivery status back to the relay
4. Sends periodic heartbeats with battery/network status

## One-time setup (on the phone)

### 1. Install Termux + Termux:API

⚠️ **Install Termux from F-Droid**, not Google Play. The Play Store version is outdated and broken.

- Termux: https://f-droid.org/en/packages/com.termux/
- Termux:API: https://f-droid.org/en/packages/com.termux.api/

### 2. Install dependencies

Open Termux, then:

```bash
pkg update && pkg upgrade -y
pkg install nodejs termux-api git
```

### 3. Grant SMS permission

- Android Settings → Apps → Termux:API → Permissions → enable **SMS**

### 4. Get the phone agent code

```bash
cd ~
git clone https://github.com/heynickquick/simble.git
cd simble/phone-agent
npm install
```

(Or copy `agent.js` and `package.json` over any other way — the script is self-contained.)

### 5. Register the device and get a token

From your laptop (or anywhere with curl):

```bash
curl -X POST https://sms.simble.unscale.cloud/devices \
  -H "Authorization: Bearer YOUR_SMS_RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name":"Friend Pixel 3a"}'
```

The response includes `"token": "sim_xxxxxxxx..."`. **Save this — it's shown only once.**

### 6. Start the agent

Back on the phone:

```bash
RELAY_URL=https://sms.simble.unscale.cloud \
  DEVICE_TOKEN=sim_xxxxxxxx... \
  node agent.js
```

You should see:
```
[simble-agent] starting, relay=https://sms.simble.unscale.cloud
[simble-agent] token=sim_xxxxxx...
[heartbeat] OK
[simble-agent] now polling for messages...
```

Send a test SMS via the Simble UI or API. Within 5 seconds, the phone should send it.

### 7. (Optional) Auto-start on boot

Use Termux:Boot (from F-Droid):

```bash
pkg install termux-boot
```

Create `~/.termux/boot/start-simble.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/simble/phone-agent
RELAY_URL=https://sms.simble.unscale.cloud \
  DEVICE_TOKEN=sim_xxx... \
  node agent.js >> ~/simble-agent.log 2>&1 &
```

Then:

```bash
chmod +x ~/.termux/boot/start-simble.sh
```

Now the agent will start automatically when the phone boots, and `termux-wake-lock` keeps the CPU on while the script runs.

## Testing without a real phone

The same `agent.js` script can be run on a Linux server for testing — the only Termux-specific commands are the SMS sending, heartbeat collection, and storage permissions. The polling/report logic works anywhere.

To test the relay without a real phone:

```bash
# On the VPS, manually enqueue a message:
curl -X POST https://sms.simble.unscale.cloud/messages \
  -H "Authorization: Bearer YOUR_SMS_RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"sim_xxx", "to":"+15551234567", "message":"test"}'

# Then in mongo, the message will be status=queued
# When a phone polls, it picks up the message and tries to send (fails on non-Android)
```

## Files

- `agent.js` — the polling script (~120 LOC)
- `package.json` — only `axios` dep
- `README.md` — this file

The whole agent is **~150 lines of code**, fully auditable, with **zero third-party Android dependencies** beyond Termux itself.
