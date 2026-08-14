# Simble Watchdog

Monitors textbee device health and alerts via Telegram when a device goes dark.

Runs as a long-lived process. Polls each textbee device's status every `POLL_INTERVAL_MS`. If a device is offline for more than `OFFLINE_THRESHOLD_MS`, sends a Telegram alert. Cooldown between repeat alerts: `ALERT_COOLDOWN_MS`.

## Setup
1. Create a Telegram bot via @BotFather. Get the token.
2. Message the bot once (so it can DM you).
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your `chat_id`.
4. Add the bot token, chat id, and your textbee API details to `.env`.
5. `docker compose up -d watchdog`

## Telegram alerts
- 🚨 device offline
- ✅ device recovered
- 🐶 watchdog started

## Why a separate service
- Decoupled from campaign-manager — keeps the SMS pipeline independent
- Can be deployed to the friend's Pi later for faster local detection
- Pure HTTP, no DB needed
