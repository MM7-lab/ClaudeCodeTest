package hk.mm7lab.watchcat

import android.content.Context
import android.content.SharedPreferences
import hk.mm7lab.watchcat.core.Codec
import hk.mm7lab.watchcat.core.Day
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.Settings
import hk.mm7lab.watchcat.core.Stats
import hk.mm7lab.watchcat.core.Timer
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.LocalDate
import java.time.ZoneId

/** Everything the app keeps, in SharedPreferences. [changes] ticks whenever something changes. */
object Store {
    private var prefs: SharedPreferences? = null
    val changes = MutableStateFlow(0L)

    private fun p(ctx: Context): SharedPreferences =
        prefs ?: ctx.applicationContext.getSharedPreferences("watchcat", Context.MODE_PRIVATE).also { prefs = it }

    private fun bump() { changes.value = changes.value + 1 }

    val zone: ZoneId get() = ZoneId.systemDefault()
    fun date(): String = LocalDate.now(zone).toString()

    fun settings(ctx: Context): Settings = Codec.settings { p(ctx).getString(it, null) }

    fun saveSettings(ctx: Context, s: Settings) {
        p(ctx).edit().apply { Codec.settings(s).forEach { (k, v) -> putString(k, v) } }.apply()
        bump()
    }

    fun timer(ctx: Context): Timer = Codec.timer { p(ctx).getString(it, null) }

    fun saveTimer(ctx: Context, t: Timer) {
        p(ctx).edit().apply { Codec.timer(t).forEach { (k, v) -> putString(k, v) } }.apply()
        bump()
    }

    fun stats(ctx: Context): Stats = Stats.decode(p(ctx).getString("stats", null))
    fun today(ctx: Context): Day = stats(ctx).today(date())

    /** Change today's record and return it. */
    fun updateDay(ctx: Context, f: (Day) -> Day): Day {
        val s = stats(ctx).update(date(), f)
        p(ctx).edit().putString("stats", s.encode()).apply()
        bump()
        return s.today(date())
    }

    /** The last step count read (the counter runs from the watch's last restart), or -1. */
    fun lastSteps(ctx: Context): Long = p(ctx).getLong("steps", -1L)
    fun saveSteps(ctx: Context, n: Long) { if (n >= 0) p(ctx).edit().putLong("steps", n).apply() }

    /** What the pet said last, and when. */
    fun line(ctx: Context): Pair<String, Long> = (p(ctx).getString("line", "") ?: "") to p(ctx).getLong("lineAt", 0L)

    /** Something the pet is doing for a moment (drinking, stretching...), and when it started. */
    fun act(ctx: Context): Pair<Pose, Long> =
        (runCatching { Pose.valueOf(p(ctx).getString("act", "") ?: "") }.getOrNull() ?: Pose.IDLE) to p(ctx).getLong("actAt", 0L)

    fun say(ctx: Context, line: String, act: Pose? = null) {
        val now = System.currentTimeMillis()
        p(ctx).edit().apply {
            putString("line", line); putLong("lineAt", now)
            if (act != null) { putString("act", act.name); putLong("actAt", now) }
        }.apply()
        bump()
    }

    fun asked(ctx: Context): Boolean = p(ctx).getBoolean("asked", false)
    fun setAsked(ctx: Context) { p(ctx).edit().putBoolean("asked", true).apply() }

    var lastTileWater = 0L
}
