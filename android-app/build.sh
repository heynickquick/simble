#!/usr/bin/env bash
# Build the Simble Gateway Android APK.
# Requires: JDK 17, Android SDK (build-tools 34, platform-android-34), Gradle 8.7
# Optional: Android Studio (easiest way to get the SDK)
#
# Usage: ./build.sh
# Output: app/build/outputs/apk/release/app-release-unsigned.apk

set -euo pipefail
cd "$(dirname "$0")"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

# Verify Java
if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java not found. Install JDK 17 (e.g. Eclipse Temurin, OpenJDK, or use Android Studio's bundled JBR)."
  exit 1
fi

# Verify SDK
if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "ERROR: Android SDK not found at $ANDROID_HOME"
  echo "Install via Android Studio: https://developer.android.com/studio"
  echo "Or set ANDROID_HOME to your SDK location."
  exit 1
fi

# Verify build-tools
if [[ ! -d "$ANDROID_HOME/build-tools" ]]; then
  echo "ERROR: build-tools not found. Run: sdkmanager 'build-tools;34.0.0'"
  exit 1
fi

# Verify platform
if [[ ! -d "$ANDROID_HOME/platforms/android-34" ]]; then
  echo "ERROR: android-34 platform not found. Run: sdkmanager 'platforms;android-34'"
  exit 1
fi

# Create local.properties
echo "sdk.dir=$ANDROID_HOME" > local.properties

# Make gradlew executable
chmod +x gradlew

# Build
echo "==> Building APK (this may take a few minutes on first run)..."
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
if [[ -f "$APK_PATH" ]]; then
  echo ""
  echo "✅ APK built: $APK_PATH"
  echo "Size: $(du -h $APK_PATH | cut -f1)"
  echo ""
  echo "Sideload onto a phone:"
  echo "  adb install $APK_PATH"
  echo ""
  echo "Or copy it to the phone and tap to install (requires 'Install unknown apps' permission)."
else
  echo "ERROR: APK not found at $APK_PATH"
  exit 1
fi
