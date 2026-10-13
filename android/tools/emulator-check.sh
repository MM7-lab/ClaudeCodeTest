#!/usr/bin/env bash
# Runs inside the CI Android emulator. Installs the app, lets it read notifications, posts a
# payment notification and an OTP notification from adb, and checks that the payment is captured
# with a confirm notification, the OTP is ignored, and the ledger page sees the pending payment.
set -uo pipefail
PKG=hk.mm7.ledger
APK=$(ls apk/*.apk | head -1)
mkdir -p shots
fail() {
  echo "FAIL: $*"
  adb logcat -d -s LedgerListener LedgerWeb AndroidRuntime | tail -80
  exit 1
}

adb install -r -g "$APK" || fail "install"
adb shell cmd notification allow_listener "$PKG/$PKG.PaymentListener" || fail "allow listener"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" || fail "start"
sleep 12
adb exec-out screencap -p > shots/1-open.png
adb logcat -d -s LedgerWeb | grep -q "\[ledger\] pending 0" || fail "the page did not load inside the app"

adb shell "cmd notification post -S bigtext -t PayMe pay1 '你已付款 HK\$50.00 給 7-Eleven'"
adb shell "cmd notification post -S bigtext -t HSBC otp1 'Your OTP is 123456 for HKD 500.00'"
sleep 6
adb logcat -d -s LedgerListener | tee shots/listener.txt
grep -q "captured exp 50.0" shots/listener.txt || fail "the payment notification was not read"
if grep -q "500.0" shots/listener.txt; then fail "the OTP notification was read as a payment"; fi
adb shell dumpsys notification --noredact | grep -q "pkg=$PKG" || fail "no confirm notification was shown"
adb logcat -d -s LedgerWeb | grep -q "\[ledger\] pending 1" || fail "the page did not pick up the pending payment"
adb exec-out screencap -p > shots/2-pending.png
echo "emulator check passed"
