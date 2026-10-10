package hk.mm7lab.watchcat

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.Reminders

/** The home-screen widget (小工具): the pet, the next reminder, today's water and a +1 button. */
class PetWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) = update(ctx)

    companion object {
        fun update(ctx: Context) {
            val manager = AppWidgetManager.getInstance(ctx)
            val ids = manager.getAppWidgetIds(ComponentName(ctx, PetWidget::class.java))
            if (ids.isEmpty()) return
            val now = System.currentTimeMillis()
            val s = Store.settings(ctx)
            val t = Store.timer(ctx)
            val day = Store.today(ctx)
            val mood = Mood.level(day, s.waterGoal)
            val pending = t.pending
            val next = Reminders.upcoming(s, t.orderIdx)?.first
            val quiet = Reminders.inQuiet(s, now, Store.zone)
            val pose = when {
                pending != null -> Actions.poseFor(pending)
                s.paused || quiet -> Pose.SLEEP
                mood >= 3 -> Pose.DANCE
                mood >= 1 -> Pose.HAPPY
                else -> Pose.IDLE
            }
            val v = RemoteViews(ctx.packageName, R.layout.widget_pet)
            v.setImageViewBitmap(R.id.pet, PetBitmap.of(ctx, s.look, Frame(0f, pose, 1f, mood), 240))
            v.setTextViewText(R.id.title, "${s.name} · ${Mood.NAMES[mood]}")
            v.setTextViewText(
                R.id.next,
                when {
                    s.paused -> "⏸ 提醒暫停咗"
                    pending != null -> "${pending.emoji} 等緊你${pending.label}！"
                    quiet -> "🌙 瞓緊覺"
                    next != null -> "下次 ${next.emoji} ${hhmm(t.nextAt)} ${next.label}"
                    else -> "冇開提醒"
                },
            )
            v.setTextViewText(R.id.water, "💧 今日 ${day.water}/${s.waterGoal} 杯")
            val open = PendingIntent.getActivity(
                ctx, 40, Intent(ctx, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            v.setOnClickPendingIntent(R.id.root, open)
            val add = PendingIntent.getBroadcast(
                ctx, 41, Intent(ctx, ActionReceiver::class.java).setAction(ActionReceiver.WATER),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            v.setOnClickPendingIntent(R.id.add, add)
            manager.updateAppWidget(ids, v)
        }
    }
}

/** The phone's widget. */
object Surfaces {
    fun refresh(ctx: Context) {
        runCatching { PetWidget.update(ctx) }
    }
}
