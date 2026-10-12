#!/usr/bin/env bash
# Runs inside the CI Android emulator. Installs the debug app, lets it read notifications, posts
# a payment notification and an OTP notification from adb, and checks that the payment becomes a
# pending entry with a confirm notification, the OTP is ignored, and 記帳 adds it to the ledger.
set -uo pipefail
PKG=hk.mm7lab.tripwallet.check
APK=$(ls apk/*.apk | head -1)
mkdir -p shots
fail() {
  echo "FAIL: $*"
  adb logcat -d -s TripListener TripWeb AndroidRuntime | tail -80
  exit 1
}

adb install -r -g "$APK" || fail "install"
adb shell cmd notification allow_listener "$PKG/hk.mm7lab.tripwallet.PaymentListener" || fail "allow listener"
adb logcat -c
adb shell am start -W -n "$PKG/hk.mm7lab.tripwallet.MainActivity" || fail "start"
sleep 12
adb exec-out screencap -p > shots/1-open.png
adb logcat -d -s TripWeb | grep -q "\[trip\] pending 0" || fail "the page did not load inside the app"

adb shell "cmd notification post -S bigtext -t PayMe pay1 '你已付款 HK\$50.00 給 7-Eleven'"
adb shell "cmd notification post -S bigtext -t HSBC otp1 'Your OTP is 123456 for HKD 500.00'"
sleep 6
adb logcat -d -s TripListener | tee shots/listener.txt
grep -q "pending HKD 50.0" shots/listener.txt || fail "the payment notification was not read"
if grep -q "pending HKD 500.0" shots/listener.txt; then fail "the OTP notification was read as a payment"; fi
adb shell dumpsys notification --noredact | grep -q "pkg=$PKG" || fail "no confirm notification was shown"
adb exec-out screencap -p > shots/2-pending.png

adb shell am start -n "$PKG/hk.mm7lab.tripwallet.MainActivity" --ez debugConfirmAll true
sleep 6
adb logcat -d -s TripWeb | grep -q "\[trip\] synced 1" || fail "the confirmed payment did not reach the ledger"
adb exec-out screencap -p > shots/3-ledger.png
echo "emulator check passed"
