package hk.mm7lab.watchcat

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hk.mm7lab.watchcat.core.RType

/**
 * Reminder notifications. Each kind buzzes differently, so you can tell them apart without
 * looking: water two short taps, rest one long, toilet three quick ones. The app does the buzzing
 * itself (the channels are silent), so the patterns are the same on every watch.
 */
object Notifier {
    private const val REMIND = "remind"
    private const val INFO = "info"
    const val ID = 7

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(REMIND, "提醒", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "飲水、休息、去廁所提醒"
                enableVibration(false)
                setSound(null, null)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(INFO, "貓貓話你知", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "行路當休息之類嘅小通知"
                enableVibration(false)
                setSound(null, null)
            },
        )
    }

    fun pattern(type: RType, strong: Boolean): LongArray = when (type) {
        RType.WATER -> if (strong) longArrayOf(0, 260, 160, 260, 160, 260) else longArrayOf(0, 130, 110, 130)
        RType.REST -> if (strong) longArrayOf(0, 750, 220, 750) else longArrayOf(0, 480)
        RType.TOILET -> if (strong) longArrayOf(0, 180, 110, 180, 110, 180, 110, 180) else longArrayOf(0, 90, 80, 90, 80, 90)
    }

    /** Buzz, unless the watch is on Do Not Disturb (or bedtime / theatre mode). */
    fun buzz(ctx: Context, pattern: LongArray) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm != null && nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL) return
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else ctx.getSystemService(Vibrator::class.java)
        v?.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    private fun action(ctx: Context, what: String, code: Int) = PendingIntent.getBroadcast(
        ctx, code, Intent(ctx, ActionReceiver::class.java).setAction(what),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun openReminder(ctx: Context, code: Int = 20): PendingIntent = PendingIntent.getActivity(
        ctx, code, Intent(ctx, ReminderActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun remind(ctx: Context, type: RType, petName: String, line: String, strong: Boolean) {
        val n = NotificationCompat.Builder(ctx, REMIND)
            .setSmallIcon(R.drawable.ic_paw)
            .setContentTitle("${type.emoji} ${type.title}")
            .setContentText("$petName：$line")
            .setStyle(NotificationCompat.BigTextStyle().bigText("$petName：$line"))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openReminder(ctx))
            .setFullScreenIntent(openReminder(ctx, 21), true)
            .setAutoCancel(true)
            .addAction(R.drawable.ic_paw, "搞掂 ✓", action(ctx, ActionReceiver.DONE, 10))
            .addAction(R.drawable.ic_paw, "遲啲先 ⏰", action(ctx, ActionReceiver.LATER, 11))
            .build()
        post(ctx, ID, n)
        buzz(ctx, pattern(type, strong))
    }

    fun info(ctx: Context, title: String, text: String) {
        val n = NotificationCompat.Builder(ctx, INFO)
            .setSmallIcon(R.drawable.ic_paw)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setTimeoutAfter(10 * 60_000L)
            .build()
        post(ctx, ID + 1, n)
        buzz(ctx, longArrayOf(0, 60))
    }

    private fun post(ctx: Context, id: Int, n: android.app.Notification) {
        try { NotificationManagerCompat.from(ctx).notify(id, n) } catch (_: SecurityException) { /* not allowed */ }
    }

    fun cancel(ctx: Context) = NotificationManagerCompat.from(ctx).cancel(ID)
}
