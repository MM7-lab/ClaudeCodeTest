package hk.mm7.ledger;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

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

    private void handle(StatusBarNotification sbn) throws JSONException {
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName()) || sbn.isOngoing()) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (PaymentParser.isExcludedPackage(pkg) || pkg.equals(Telephony.Sms.getDefaultSmsPackage(this))) return;

        Bundle ex = n.extras;
        if (ex == null) return;
        String title = str(ex.getCharSequence(Notification.EXTRA_TITLE));
        String text = str(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (text.isEmpty()) text = str(ex.getCharSequence(Notification.EXTRA_TEXT));
        PaymentParser.Result r = PaymentParser.parse(title, text);
        if (r == null) return;

        Store store = Store.get(this);
        String label = appLabel(pkg);
        long ts = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        store.noteSource(pkg, label, ts);
        if (!store.sourceEnabled(pkg)) return;

        boolean auto = store.autoMode();
        JSONObject p = new JSONObject()
                .put("id", Store.newId())
                .put("pkg", pkg)
                .put("app", label)
                .put("amt", r.amount)
                .put("type", r.type)
                .put("note", r.note)
                .put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ts)))
                .put("ts", ts)
                .put("status", auto ? "ok" : "new");
        if (store.addPending(p)) Notifier.captured(this, p, auto);
    }

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

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }
}
