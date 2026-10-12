package hk.mm7lab.tripwallet

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/** The one-tap confirm notification: "記帳？¥1,280 · PayPay" with 記帳 and 略過 buttons. */
object Notifier {
    private const val CHANNEL = "confirm"

    fun ensureChannel(c: Context) {
        val nm = c.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, c.getString(R.string.channel_confirm), NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = c.getString(R.string.channel_confirm_desc)
            },
        )
    }

    fun money(amount: Double, cur: String): String {
        val f = NumberFormat.getNumberInstance(Locale.US)
        return if (cur == "JPY") {
            f.maximumFractionDigits = 0
            "¥" + f.format(amount)
        } else {
            f.minimumFractionDigits = 2
            f.maximumFractionDigits = 2
            "HK$" + f.format(amount)
        }
    }

    fun notificationId(id: String) = id.hashCode()

    fun askToConfirm(c: Context, item: JSONObject) {
        ensureChannel(c)
        val id = item.getString("id")
        val amount = money(item.getDouble("amount"), item.getString("cur"))
        val open = PendingIntent.getActivity(
            c, notificationId(id), Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_yen)
            .setContentTitle("記帳？$amount · ${item.optString("app")}")
            .setContentText(item.optString("text"))
            .setStyle(Notification.BigTextStyle().bigText(item.optString("text")))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .addAction(Notification.Action.Builder(null, "記帳", action(c, id, ActionReceiver.CONFIRM)).build())
            .addAction(Notification.Action.Builder(null, "略過", action(c, id, ActionReceiver.SKIP)).build())
            .build()
        runCatching { c.getSystemService(NotificationManager::class.java).notify(notificationId(id), n) }
    }

    fun cancel(c: Context, id: String) {
        c.getSystemService(NotificationManager::class.java).cancel(notificationId(id))
    }

    private fun action(c: Context, id: String, what: String): PendingIntent {
        val i = Intent(c, ActionReceiver::class.java).setAction(what).putExtra(ActionReceiver.EXTRA_ID, id)
        return PendingIntent.getBroadcast(
            c, (what + id).hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
