package hk.mm7.ledger;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;

/** Monthly 365-day challenge reminder: "11月要存 $2,790（第 305–334 日）". */
public class ChallengeReminder extends BroadcastReceiver {
    static final String ACTION = "hk.mm7.ledger.CHALLENGE_REMIND";
    private static final int NOTIF_ID = 365;

    @Override
    public void onReceive(Context c, Intent intent) {
        if (!ACTION.equals(intent.getAction())) return;
        Challenge ch = Store.get(c).challenge();
        if (ch != null && ch.on) notifyMonth(c, ch, YearMonth.now());
        schedule(c);
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, ChallengeReminder.class).setAction(ACTION);
        return PendingIntent.getBroadcast(c, NOTIF_ID, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** (Re)arms the next monthly alarm; inexact, so no special alarm permission is needed. */
    static void schedule(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c);
        am.cancel(pi);
        Challenge ch = Store.get(c).challenge();
        if (ch == null || !ch.on) return;
        LocalDateTime next = ch.nextReminder(LocalDateTime.now());
        if (next == null) return;
        long at = next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    static boolean notifyMonth(Context c, Challenge ch, YearMonth ym) {
        long[] r = ch.range(ym);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (r == null || nm == null) return false;
        Notifier.ensureChannel(c);
        String text = ym.getMonthValue() + "月要存 " + Notifier.money(ch.need(r[0], r[1]))
                + "（第 " + r[0] + "–" + r[1] + " 日），撳入去睇已存幾多同轉帳。";
        Intent open = new Intent(c, MainActivity.class)
                .putExtra(MainActivity.EXTRA_OPEN, "challenge")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Notification n = new Notification.Builder(c, Notifier.REMINDER_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(0xFF6339B5)
                .setContentTitle("365 日儲錢挑戰")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, NOTIF_ID, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .build();
        try {
            nm.notify(NOTIF_ID, n);
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }
}
