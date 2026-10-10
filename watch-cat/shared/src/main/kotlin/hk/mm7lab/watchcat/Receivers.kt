package hk.mm7lab.watchcat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Work in a receiver that may wait a moment (for the step counter). */
private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

private fun BroadcastReceiver.work(block: suspend () -> Unit) {
    val pending = goAsync()
    scope.launch {
        try { block() } finally { pending.finish() }
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = work { Actions.alarm(ctx) }
}

/** The buttons on a reminder notification. */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = work {
        when (intent.action) {
            DONE -> Actions.answer(ctx, true)
            LATER -> Actions.answer(ctx, false)
            WATER -> Actions.addWater(ctx)
            else -> {}
        }
    }

    companion object {
        const val DONE = "hk.mm7lab.watchcat.DONE"
        const val LATER = "hk.mm7lab.watchcat.LATER"
        const val WATER = "hk.mm7lab.watchcat.WATER"
    }
}

/** Alarms are lost when the watch restarts or the app is updated: set it again. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Scheduler.ensure(ctx)
        Actions.refresh(ctx)
    }
}
