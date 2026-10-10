package hk.mm7lab.watchcat

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import hk.mm7lab.watchcat.core.MIN
import hk.mm7lab.watchcat.core.Reminders

/** One alarm at a time, for the next reminder (or the next buzz of one still waiting). */
object Scheduler {
    private fun intent(ctx: Context) = PendingIntent.getBroadcast(
        ctx, 1, Intent(ctx, AlarmReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun set(ctx: Context, at: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = intent(ctx)
        val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }

    fun cancel(ctx: Context) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(intent(ctx))
    }

    /** Make sure the alarm is set (after a restart, an update, or opening the app). */
    fun ensure(ctx: Context) {
        val s = Store.settings(ctx)
        if (s.paused) { cancel(ctx); return }
        val now = System.currentTimeMillis()
        var t = Store.timer(ctx)
        // never started, or long overdue (the watch was off): start the wait again
        if (t.nextAt <= 0L || (t.pending == null && t.nextAt < now - MIN)) {
            t = Reminders.restart(s, t, now, Store.lastSteps(ctx), Store.zone)
            Store.saveTimer(ctx, t)
        }
        set(ctx, maxOf(t.nextAt, now + 1000L))
    }
}
