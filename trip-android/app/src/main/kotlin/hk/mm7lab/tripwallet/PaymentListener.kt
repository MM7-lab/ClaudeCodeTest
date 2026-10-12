package hk.mm7lab.tripwallet

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import hk.mm7lab.tripwallet.core.PaymentParser

/**
 * Reads notifications from the payment apps the person watches and turns spending into a
 * pending entry plus a one-tap confirm notification. Runs only on this phone: nothing is sent
 * anywhere, and notifications that don't hold a payment are not stored.
 */
class PaymentListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName
        if (pkg == packageName) return
        val n = sbn.notification ?: return
        if ((n.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

        val label = appLabel(pkg)
        Store.noteSeen(this, pkg, label)
        if (!Store.isWatched(this, pkg, label)) return

        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString().orEmpty()

        val payment = PaymentParser.parse(title, body, label, pkg)
        if (payment == null) {
            Log.i(TAG, "no payment in a notification from $pkg")
            return
        }
        val item = Store.addPending(this, payment, label, sbn.postTime, sbn.key) ?: return
        Log.i(TAG, "pending ${payment.currency} ${payment.amount} from $pkg")
        Notifier.askToConfirm(this, item)
    }

    @Suppress("DEPRECATION")
    private fun appLabel(pkg: String): String = runCatching {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)

    companion object {
        private const val TAG = "TripListener"
    }
}
