# Firebase Setup for textbee

textbee uses Firebase Cloud Messaging (FCM) to push commands to the Android app (send this SMS, etc.). You need a free Firebase project.

## Steps

### 1. Create Firebase project
- Go to https://console.firebase.google.com
- Click "Add project" — name it (e.g. `msg-platform-prod`)
- Disable Google Analytics (not needed)
- Click Create

### 2. Enable Cloud Messaging
- In the project, go to **Project Settings** (gear icon) → **Cloud Messaging**
- Note the **Sender ID** and **Project ID**

### 3. Create a service account (for the API server)
- Go to **Project Settings** → **Service Accounts**
- Click "Generate new private key"
- A JSON file downloads — this is your `firebase-credentials.json`
- Move it to `infra/firebase-credentials.json` in this repo (gitignored)
- Open it and copy these values into `.env`:
  - `project_id` → `FIREBASE_PROJECT_ID`
  - `client_email` → `FIREBASE_CLIENT_EMAIL`
  - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the BEGIN/END markers; escape real newlines as `\n` literals in the .env value)

### 4. Add Firebase to the Android app
- In Firebase console: **Project Settings** → **Your apps** → **Add app** → **Android**
- Package name: `dev.textbee.android`
- Download `google-services.json`
- Place it at `textbee/android/app/google-services.json`
- Rebuild the Android app per textbee's build instructions

## Costs
Firebase FCM is **free** for unlimited messages.
