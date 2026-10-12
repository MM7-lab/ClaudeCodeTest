package hk.mm7lab.tripwallet

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Handles the 記帳 / 略過 buttons on the confirm notification. */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        when (intent.action) {
            CONFIRM -> Store.confirm(context, id)
            SKIP -> Store.skip(context, id)
            else -> return
        }
        Log.i("TripListener", "${intent.action} $id")
        Notifier.cancel(context, id)
    }

    companion object {
        const val CONFIRM = "hk.mm7lab.tripwallet.CONFIRM"
        const val SKIP = "hk.mm7lab.tripwallet.SKIP"
        const val EXTRA_ID = "id"
    }
}
