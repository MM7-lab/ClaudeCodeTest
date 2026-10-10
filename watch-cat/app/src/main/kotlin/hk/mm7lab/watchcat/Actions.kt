package hk.mm7lab.watchcat

import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import hk.mm7lab.watchcat.core.Lines
import hk.mm7lab.watchcat.core.Outcome
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.RType
import hk.mm7lab.watchcat.core.Reminders
import hk.mm7lab.watchcat.core.Settings
import kotlin.random.Random

/** The things that can happen, from the alarm, a notification button, the app, or the tile. */
object Actions {
    fun poseFor(type: RType) = when (type) {
        RType.WATER -> Pose.WATER
        RType.REST -> Pose.REST
        RType.TOILET -> Pose.TOILET
    }

    /** The alarm went off. */
    suspend fun alarm(ctx: Context) {
        val s = Store.settings(ctx)
        val now = System.currentTimeMillis()
        val steps = Steps.read(ctx)
        val step = Reminders.onAlarm(s, Store.timer(ctx), now, steps, Store.zone)
        Store.saveTimer(ctx, step.timer)
        when (val o = step.outcome) {
            is Outcome.Remind -> {
                val line = Lines.remind(o.type, s.look, Random.nextInt(100))
                Store.say(ctx, line, poseFor(o.type))
                Notifier.remind(ctx, o.type, s.name, line, s.strongBuzz)
            }
            is Outcome.Nag -> Notifier.remind(ctx, o.type, s.name, Store.line(ctx).first, s.strongBuzz)
            is Outcome.AutoRest -> {
                Store.updateDay(ctx) { it.add(RType.REST).copy(walks = it.walks + 1) }
                val line = Lines.autoRest(o.steps)
                Store.say(ctx, line, Pose.HAPPY)
                Notifier.info(ctx, "🚶 ${s.name}", line)
            }
            Outcome.Quiet, Outcome.None -> Notifier.cancel(ctx)
        }
        if (!s.paused) Scheduler.set(ctx, step.timer.nextAt)
        refresh(ctx)
    }

    /** You answered the reminder that's waiting: done, or later. Returns what was waiting. */
    suspend fun answer(ctx: Context, done: Boolean): RType? {
        val s = Store.settings(ctx)
        val t = Store.timer(ctx)
        val type = t.pending ?: return null
        val steps = Steps.read(ctx)
        val next = Reminders.answer(s, t, done, System.currentTimeMillis(), steps, Store.zone)
        Store.saveTimer(ctx, next)
        if (done) {
            val day = Store.updateDay(ctx) { it.add(type) }
            Store.say(ctx, Lines.thanks(type, day, s.waterGoal), if (type == RType.WATER) Pose.WATER else Pose.HAPPY)
        } else {
            Store.say(ctx, Lines.later())
        }
        Notifier.cancel(ctx)
        Scheduler.set(ctx, next.nextAt)
        refresh(ctx)
        return type
    }

    /** One more cup of water (from the tile or the app). Answers a water reminder if one is waiting. */
    suspend fun addWater(ctx: Context) {
        if (Store.timer(ctx).pending == RType.WATER) { answer(ctx, true); return }
        val s = Store.settings(ctx)
        val day = Store.updateDay(ctx) { it.add(RType.WATER) }
        Store.say(ctx, Lines.thanks(RType.WATER, day, s.waterGoal), Pose.WATER)
        refresh(ctx)
    }

    /** Stroking the pet. */
    fun pet(ctx: Context): String {
        val s = Store.settings(ctx)
        Store.updateDay(ctx) { it.copy(pets = it.pets + 1) }
        val line = Lines.petted(s.look, Random.nextInt(100))
        Store.say(ctx, line, Pose.HAPPY)
        return line
    }

    /** New settings. If anything about the timing changed, the wait starts again. */
    fun changeSettings(ctx: Context, new: Settings) {
        val old = Store.settings(ctx)
        Store.saveSettings(ctx, new)
        val timing = old.copy(petId = new.petId, name = new.name, waterGoal = new.waterGoal, strongBuzz = new.strongBuzz, style3d = new.style3d) != new
        if (timing) {
            val t = Reminders.restart(new, Store.timer(ctx), System.currentTimeMillis(), Store.lastSteps(ctx), Store.zone)
            Store.saveTimer(ctx, t)
            Notifier.cancel(ctx)
            if (new.paused) Scheduler.cancel(ctx) else Scheduler.set(ctx, t.nextAt)
        }
        refresh(ctx)
    }

    /** Try out the next reminder's buzz and screen, without changing anything. */
    fun test(ctx: Context) {
        val s = Store.settings(ctx)
        val type = Reminders.upcoming(s, Store.timer(ctx).orderIdx)?.first ?: RType.WATER
        Notifier.buzz(ctx, Notifier.pattern(type, s.strongBuzz))
        ctx.startActivity(
            android.content.Intent(ctx, ReminderActivity::class.java)
                .putExtra(ReminderActivity.TEST, type.id)
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Ask the tile and the complication to show the latest. */
    fun refresh(ctx: Context) {
        runCatching { TileService.getUpdater(ctx).requestUpdate(PetTileService::class.java) }
        runCatching {
            ComplicationDataSourceUpdateRequester
                .create(ctx, ComponentName(ctx, PetComplicationService::class.java))
                .requestUpdateAll()
        }
    }
}
