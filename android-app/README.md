# Simble Gateway (Android app)

Native Android app that turns any Android phone into an SMS gateway for Simble. The phone polls the Simble server for queued messages, sends them via the carrier SIM, and reports delivery back.

## Features

- **QR code pairing** — scan a QR from the Simble web UI, no token-typing
- **Foreground service** — keeps a persistent notification, polls the server every 5s
- **Auto-start on boot** — runs as soon as the phone powers on
- **Battery optimization exemption** — guides the user to disable Doze mode
- **Statistics** — sent / delivered / failed counters visible in the app
- **Manual token entry** — fallback for QR scanning issues

## What it doesn't do

- **Doesn't need Firebase** (unlike the old textbee setup). Pure HTTP polling.
- **Doesn't run on iOS** — iOS background SMS is severely restricted. Use the [phone-agent (Termux)](../phone-agent) if you need a non-Play-Store solution, or this app on Android only.
- **No UI for managing campaigns** — the Simble web UI (https://simble.unscale.cloud) handles that. This app is just the "phone side."

## How it works

```
Simble web UI                          Android phone
┌────────────┐                         ┌────────────────┐
│ User clicks│                         │ Simble Gateway │
│ "Pair      │────QR code──────────▶   │ app scans QR   │
│  device"   │                         │ saves token    │
└─────┬──────┘                         └────────┬───────┘
      │                                        │
      │  campaign-manager                       │
      │  queues SMS                             │
      ▼                                        │
   sms-relay ──long-poll──▶  app sends SMS ─────┘
                  ◀──report──┘
```

## Building the APK

### Option 1: Android Studio (easiest)

1. Install [Android Studio](https://developer.android.com/studio)
2. Open the `android-app/` directory
3. Wait for Gradle sync
4. **Build → Generate Signed Bundle / APK → APK → Release → Create new keystore**
5. APK appears at `app/build/outputs/apk/release/app-release.apk`

### Option 2: Command line

Prerequisites: JDK 17, Android SDK with build-tools 34 and android-34 platform.

```bash
cd android-app
export ANDROID_HOME=$HOME/Android/Sdk  # or wherever you installed it
./build.sh
```

Output: `app/build/outputs/apk/release/app-release-unsigned.apk`

For the unsigned APK, sign it with `apksigner` or just use Android Studio's "debug" build for sideloading (works on most phones for personal use).

## Sideloading to a phone

```bash
adb install app/build/outputs/apk/release/app-release-unsigned.apk
```

Or:
1. Copy the APK to the phone (USB, email, Google Drive, etc.)
2. On the phone, enable "Install unknown apps" for your file manager
3. Tap the APK file
4. Tap "Install"

## First-run setup

1. Open the app
2. Grant permissions: SMS, Camera, Notifications, Phone State
3. Enter server URL (default: `https://simble.unscale.cloud`)
4. Open the Simble web UI → Devices → click "Pair" → shows QR
5. Tap "Scan QR code" in the app → scan the QR
6. The app shows the status screen with the service running

## Auto-start behavior

- On boot: `BootReceiver` starts `SmsGatewayService` automatically
- On app close: service keeps running (foreground notification)
- On uninstall: all stopped (of course)

## Battery / doze mode

The app needs to poll every 5s. Android's battery optimization can kill background services. The app includes a "Disable battery optimization" button — tap it once during setup.

## Permissions

- `INTERNET` — poll the Simble server
- `SEND_SMS` — actually send the SMS
- `READ_PHONE_STATE` — get the device's own phone number
- `CAMERA` — scan the QR code
- `POST_NOTIFICATIONS` — show the persistent foreground service notification (Android 13+)
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` — keep the polling service running
- `WAKE_LOCK` — keep CPU awake while polling
- `RECEIVE_BOOT_COMPLETED` — auto-start on boot

All permissions are visible to the user at install time. The app is open-source; you can audit the code in this directory.

## Code structure

```
android-app/
├── app/
│   ├── build.gradle.kts
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/simble/gateway/
│   │   │   ├── MainActivity.kt          # Status screen, service controls
│   │   │   ├── SetupActivity.kt        # Server URL + QR scan
│   │   │   ├── QrScanActivity.kt       # Camera-based QR scanner
│   │   │   ├── SmsGatewayService.kt    # Foreground polling service
│   │   │   ├── BootReceiver.kt          # Auto-start on boot
│   │   │   ├── api/SimbleApi.kt         # HTTP client
│   │   │   └── util/Preferences.kt     # SharedPreferences wrapper
│   │   └── res/                        # layouts, strings, themes, launcher icon
│   └── proguard-rules.pro
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── build.sh                            # CLI build script
└── README.md                           # this file
```

~600 lines of Kotlin total. No build magic, no Hilt/Dagger, no Compose. Just plain Android + coroutines.
