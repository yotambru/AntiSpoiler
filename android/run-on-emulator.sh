#!/usr/bin/env bash
# Builds Anti-Spoiler, starts an Android emulator (if available), installs the app, and opens it.
# Requires ANDROID_HOME to be set (e.g. export ANDROID_HOME=~/Library/Android/sdk)

set -e
cd "$(dirname "$0")"

if [ -z "$ANDROID_HOME" ]; then
  echo "ANDROID_HOME is not set."
  echo "Example (Mac): export ANDROID_HOME=~/Library/Android/sdk"
  echo "Then run this script again."
  exit 1
fi

PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

if ! command -v adb &>/dev/null; then
  echo "adb not found. Install Android SDK Platform-Tools (e.g. via SDK Manager in Android Studio)."
  exit 1
fi

echo "Building app..."
./gradlew assembleDebug -q

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "APK not found at $APK"
  exit 1
fi

# Check if an emulator is already running
DEVICE=$(adb devices | grep -w "emulator-[0-9]*" | head -1 | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  # List AVDs and start first one if available
  AVD=$(emulator -list-avds 2>/dev/null | head -1)
  if [ -z "$AVD" ]; then
    echo "No AVD found. Create one in Android Studio: Tools → Device Manager → Create Device."
    echo "Then run this script again, or run the app from Android Studio (Run button)."
    exit 1
  fi
  echo "Starting emulator: $AVD"
  emulator -avd "$AVD" -no-snapshot-load &
  EMU_PID=$!
  echo "Waiting for emulator to boot..."
  adb wait-for-device
  # Wait until boot completed
  while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    sleep 2
  done
  echo "Emulator ready."
fi

echo "Installing app..."
adb install -r "$APK"
echo "Launching Anti-Spoiler..."
adb shell am start -n com.antispoiler.app/.MainActivity

echo ""
echo "Next steps:"
echo "1. On the emulator: tap 'הפעל שירות נגישות' and enable Anti-Spoiler in Accessibility settings."
echo "2. To test: run 'python3 -m http.server 8080' in the project root, then in emulator Chrome open:"
echo "   http://10.0.2.2:8080/android-test-page.html"
echo "   Spoiler text should be covered by a purple overlay."
