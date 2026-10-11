#!/usr/bin/env bash
# Runs on CI in an Android emulator: installs the phone app, opens it, and prints what happened
# (logcat and a small screenshot as base64) so the scene can be checked without a real phone.
set -x
APK=$(ls apk/*.apk | head -1)
PKG=hk.mm7lab.watchcat.phone
adb install -r "$APK"
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell pm grant $PKG android.permission.ACTIVITY_RECOGNITION || true
adb logcat -c
adb shell am start -W -n $PKG/hk.mm7lab.watchcat.MainActivity
sleep 30
adb exec-out screencap -p > shot1.png
adb shell input tap 540 1700
sleep 8
adb exec-out screencap -p > shot2.png
set +x
echo "===== logcat ====="
adb logcat -d | grep -E "PhoneCatScene|AndroidRuntime|FATAL" | tail -120
echo "===== inside the WebView ====="
PID=$(adb shell pidof $PKG | tr -d '\r')
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
sleep 1
node watch-cat/tools/phone-cdp.mjs || echo "devtools failed"
for f in shot1 shot2; do
  convert $f.png -resize 240x $f-small.jpg 2>/dev/null || cp $f.png $f-small.jpg
  echo "===== $f base64 begin ====="
  base64 -w 0 $f-small.jpg | fold -w 900
  echo
  echo "===== $f base64 end ====="
done
