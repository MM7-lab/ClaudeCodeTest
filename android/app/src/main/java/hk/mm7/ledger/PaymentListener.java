package hk.mm7.ledger;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Reads payment notifications (Octopus, PayMe, card and bank apps) on the phone itself.
 * Only the amount, direction, merchant and app name are kept; the notification text is not stored.
 */
public class PaymentListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handle(sbn);
        } catch (Throwable t) {
            // A bad notification must never take the listener down.
        }
    }

    @Override
    public void onListenerConnected() {
        Store.get(this).markConnected();
    }

    private void handle(StatusBarNotification sbn) throws JSONException {
        String pkg = sbn.getPackageName();
        if (pkg == null) return;
        Notification n = sbn.getNotification();
        // The in-app 自我測試 posts one of our own notifications; reading it proves the listener works.
        if (pkg.equals(getPackageName())) {
            if (n != null && n.extras != null && n.extras.getBoolean(SELF_TEST)) {
                Store.get(this).markSelfTest();
                cancelNotification(sbn.getKey());
            }
            return;
        }
        Store.get(this).markSeen(sbn.getPostTime());
        if (sbn.isOngoing()) return;
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (PaymentParser.isExcludedPackage(pkg) || pkg.equals(Telephony.Sms.getDefaultSmsPackage(this))) return;

        Bundle ex = n.extras;
        if (ex == null) return;
        String title = str(ex.getCharSequence(Notification.EXTRA_TITLE));
        if (title.isEmpty()) title = str(ex.getCharSequence(Notification.EXTRA_TITLE_BIG));
        String text = bodyOf(ex);
        boolean wallet = PaymentParser.isWallet(pkg);
        Store store = Store.get(this);
        String label = appLabel(pkg);
        long ts = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        PaymentParser.Result r = PaymentParser.parse(title, text, wallet);
        // Wallet notifications are logged even without an amount, to see what Samsung Pay / Google Pay actually post.
        if (store.debugOn() && (wallet || MONEYISH.matcher(title + "\n" + text).find())) {
            String verdict = r == null ? PaymentParser.why(title, text, wallet) : store.sourceEnabled(pkg) ? PaymentParser.why(title, text, wallet) : "略過：你熄咗呢個 App";
            store.addDebug(pkg, label, title, text, verdict, ts);
        }
        if (r == null) return;
        store.noteSource(pkg, label, ts);
        if (!store.sourceEnabled(pkg)) return;

        boolean auto = store.autoMode() && !r.needAmount;
        String note = r.note.equals(label) ? "" : r.note;
        JSONObject p = new JSONObject()
                .put("id", Store.newId())
                .put("pkg", pkg)
                .put("app", label)
                .put("amt", r.amount)
                .put("type", r.type)
                .put("note", note)
                .put("needAmt", r.needAmount)
                .put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ts)))
                .put("ts", ts)
                .put("status", auto ? "ok" : "new");
        if (store.addPending(p)) {
            // Amount and direction only; the notification text never reaches the log.
            Log.i("LedgerListener", "captured " + r.type + " " + r.amount);
            Notifier.captured(this, p, auto);
        }
    }

    static final String SELF_TEST = "hk.mm7.ledger.SELF_TEST";

    @Override
    public void onListenerDisconnected() {
        // Ask the system to reconnect us, e.g. after the app was updated or killed.
        requestRebind(new ComponentName(this, PaymentListener.class));
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(ai));
        } catch (Exception e) {
            return pkg;
        }
    }

    private static final java.util.regex.Pattern MONEYISH = java.util.regex.Pattern.compile("(?i)(HK\\$|HKD|港幣|港元|\\$\\s*[0-9]|[0-9]\\s*元)");

    /** Every text part a notification may carry: big text or text, plus sub/info/summary text and inbox lines. */
    private static String bodyOf(Bundle ex) {
        java.util.LinkedHashSet<String> parts = new java.util.LinkedHashSet<>();
        String big = str(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
        parts.add(big.isEmpty() ? str(ex.getCharSequence(Notification.EXTRA_TEXT)) : big);
        parts.add(str(ex.getCharSequence(Notification.EXTRA_SUB_TEXT)));
        parts.add(str(ex.getCharSequence(Notification.EXTRA_INFO_TEXT)));
        parts.add(str(ex.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)));
        CharSequence[] lines = ex.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) for (CharSequence l : lines) parts.add(str(l));
        parts.remove("");
        return String.join("\n", parts);
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
