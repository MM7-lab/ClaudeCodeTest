package hk.mm7.ledger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;

import org.json.JSONObject;

import java.text.DecimalFormat;

/** The one-tap confirm notification shown when a payment is captured. */
final class Notifier {
    static final String CHANNEL = "auto";
    static final String REMINDER_CHANNEL = "reminder";

    private Notifier() {}

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "自動記帳", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("偵測到付款時，一撳就記低");
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(REMINDER_CHANNEL) == null) {
            NotificationChannel r = new NotificationChannel(REMINDER_CHANNEL, "儲錢提醒", NotificationManager.IMPORTANCE_DEFAULT);
            r.setDescription("365 日儲錢挑戰：每月提你要存幾多");
            nm.createNotificationChannel(r);
        }
    }

    static int notifId(String id) {
        return id.hashCode();
    }

    static String money(double v) {
        return "$" + new DecimalFormat(v % 1 == 0 ? "#,##0" : "#,##0.00").format(v);
    }

    static void captured(Context c, JSONObject p, boolean auto) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        ensureChannel(c);
        String id = p.optString("id");
        boolean inc = "inc".equals(p.optString("type"));
        String amt = money(p.optDouble("amt"));
        String note = p.optString("note");
        String where = p.optString("app") + (note.isEmpty() ? "" : " · " + note);
        boolean needAmt = p.optBoolean("needAmt");
        String title = needAmt ? "偵測到付款（金額待填）" : auto ? "已自動記低" + (inc ? "收入 " : " ") + amt : "偵測到" + (inc ? "收款 " : "付款 ") + amt;
        String text = needAmt ? where + "　撳入去填金額" : auto ? where : where + "　撳「記低」就入帳";

        Notification.Builder b = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(0xFF6339B5)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(open(c, id));
        if (needAmt) {
            b.addAction(action(c, id, ConfirmReceiver.SKIP, "略過"));
        } else if (auto) {
            b.addAction(action(c, id, ConfirmReceiver.UNDO, "復原"));
        } else {
            b.addAction(action(c, id, ConfirmReceiver.OK, "記低"));
            b.addAction(action(c, id, ConfirmReceiver.SKIP, "略過"));
        }
        try {
            nm.notify(notifId(id), b.build());
        } catch (SecurityException e) {
            // Notification permission not granted: the payment still waits in the app's 待確認 list.
        }
    }

    private static PendingIntent open(Context c, String id) {
        Intent i = new Intent(c, MainActivity.class)
                .putExtra(MainActivity.EXTRA_OPEN, "inbox")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, ("open" + id).hashCode(), i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static Notification.Action action(Context c, String id, String what, String label) {
        Intent i = new Intent(c, ConfirmReceiver.class)
                .setAction(what)
                .putExtra(ConfirmReceiver.EXTRA_ID, id);
        PendingIntent pi = PendingIntent.getBroadcast(c, (what + id).hashCode(), i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat), label, pi).build();
    }
}
