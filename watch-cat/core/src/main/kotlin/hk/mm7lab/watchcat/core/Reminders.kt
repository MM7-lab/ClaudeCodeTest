package hk.mm7lab.watchcat.core

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

const val MIN = 60_000L

/** The three kinds of reminder, as on the desktop app. */
enum class RType(val id: String, val emoji: String, val label: String, val title: String) {
    WATER("water", "💧", "飲水", "飲水時間！"),
    REST("rest", "🙆", "休息", "休息吓啦！"),
    TOILET("toilet", "🚽", "去廁所", "去個廁所啦！");

    companion object { fun byId(id: String?) = values().firstOrNull { it.id == id } }
}

/** They take turns: water, rest, water, toilet. */
val ORDER = listOf(RType.WATER, RType.REST, RType.WATER, RType.TOILET)

data class Settings(
    val petId: String = "orange",
    val name: String = "麻糬",
    val intervalMin: Int = 30,
    val water: Boolean = true,
    val rest: Boolean = true,
    val toilet: Boolean = true,
    val quietOn: Boolean = true,      // no reminders at night
    val quietStart: Int = 23,         // hour
    val quietEnd: Int = 8,            // hour
    val walkAsRest: Boolean = true,   // walking about counts as a rest
    val stepsForRest: Int = 200,
    val waterGoal: Int = 8,
    val strongBuzz: Boolean = false,
    val paused: Boolean = false,
    val style3d: Boolean = true,      // the 3D pets (pictures made from the desktop app's model) or the flat drawings
) {
    fun enabled(t: RType) = when (t) { RType.WATER -> water; RType.REST -> rest; RType.TOILET -> toilet }
    val look: Look get() = Looks.byId(petId)

    companion object {
        val INTERVALS = listOf(15, 20, 30, 45, 60, 90)
    }
}

/**
 * Where the reminder cycle is. [pending] is a reminder waiting for an answer; [nags] how many
 * times it has buzzed again since. [stepsAtStart] is the step counter when the current wait began
 * (-1 if unknown), to tell whether you've been walking about.
 */
data class Timer(
    val orderIdx: Int = 0,
    val nextAt: Long = 0L,
    val pending: RType? = null,
    val pendingIdx: Int = 0,
    val nags: Int = 0,
    val stepsAtStart: Long = -1L,
)

/** What to do when the alarm goes off. */
sealed class Outcome {
    data class Remind(val type: RType) : Outcome()        // a new reminder
    data class Nag(val type: RType) : Outcome()           // still waiting: buzz again
    data class AutoRest(val steps: Long) : Outcome()      // walked enough: counted as a rest
    object Quiet : Outcome()                              // night time: nothing until the morning
    object None : Outcome()
}

data class Step(val timer: Timer, val outcome: Outcome)

object Reminders {
    const val NAG_MIN = 5
    const val MAX_NAGS = 3

    /** The next enabled reminder from position [idx] in the cycle (with its position), or null. */
    fun upcoming(s: Settings, idx: Int): Pair<RType, Int>? {
        for (i in ORDER.indices) {
            val j = (idx + i) % ORDER.size
            if (s.enabled(ORDER[j])) return ORDER[j] to j
        }
        return null
    }

    fun inQuiet(s: Settings, at: Long, zone: ZoneId): Boolean {
        if (!s.quietOn || s.quietStart == s.quietEnd) return false
        val h = ZonedDateTime.ofInstant(Instant.ofEpochMilli(at), zone).hour
        return if (s.quietStart < s.quietEnd) h in s.quietStart until s.quietEnd
        else h >= s.quietStart || h < s.quietEnd
    }

    /** The end of the quiet time that [at] falls in. */
    fun quietEndAfter(s: Settings, at: Long, zone: ZoneId): Long {
        var z = ZonedDateTime.ofInstant(Instant.ofEpochMilli(at), zone).withMinute(0).withSecond(0).withNano(0)
        // step forward hour by hour until we're out (at most a day)
        repeat(25) {
            if (!inQuiet(s, z.toInstant().toEpochMilli(), zone)) return z.toInstant().toEpochMilli()
            z = z.plusHours(1)
        }
        return at + s.intervalMin * MIN
    }

    /** When the next reminder is due, counting from [from]: one interval later, but not at night. */
    fun nextFire(s: Settings, from: Long, zone: ZoneId): Long {
        val at = from + s.intervalMin * MIN
        return if (inQuiet(s, at, zone)) quietEndAfter(s, at, zone) else at
    }

    /** Start (or restart) the wait for the next reminder. */
    fun restart(s: Settings, t: Timer, now: Long, steps: Long, zone: ZoneId) =
        t.copy(nextAt = nextFire(s, now, zone), pending = null, nags = 0, stepsAtStart = steps)

    /** The alarm went off at [now]; [steps] is the step counter (-1 if unknown). */
    fun onAlarm(s: Settings, t: Timer, now: Long, steps: Long, zone: ZoneId): Step {
        if (s.paused) return Step(t, Outcome.None)
        // a reminder still waiting: buzz again a few times, then let it go
        t.pending?.let { p ->
            return if (t.nags < MAX_NAGS) Step(t.copy(nags = t.nags + 1, nextAt = now + NAG_MIN * MIN), Outcome.Nag(p))
            else Step(restart(s, t, now, steps, zone), Outcome.None)
        }
        if (inQuiet(s, now, zone)) return Step(t.copy(nextAt = quietEndAfter(s, now, zone), stepsAtStart = steps), Outcome.Quiet)
        val (type, idx) = upcoming(s, t.orderIdx) ?: return Step(restart(s, t, now, steps, zone), Outcome.None)
        // time for a rest, but you've been walking about anyway: that counts
        if (type == RType.REST && s.walkAsRest) {
            val walked = walkedSince(t.stepsAtStart, steps)
            if (walked >= s.stepsForRest) {
                val next = restart(s, t, now, steps, zone).copy(orderIdx = (idx + 1) % ORDER.size)
                return Step(next, Outcome.AutoRest(walked))
            }
        }
        return Step(t.copy(pending = type, pendingIdx = idx, nags = 0, nextAt = now + NAG_MIN * MIN), Outcome.Remind(type))
    }

    /** Answered: done (counts, and moves on in the cycle) or later (same reminder in 5 minutes). */
    fun answer(s: Settings, t: Timer, done: Boolean, now: Long, steps: Long, zone: ZoneId): Timer {
        if (t.pending == null) return t
        return if (done) restart(s, t, now, steps, zone).copy(orderIdx = (t.pendingIdx + 1) % ORDER.size)
        else t.copy(pending = null, nags = 0, nextAt = now + NAG_MIN * MIN, stepsAtStart = steps)
    }

    /** Steps walked since [start]; the counter starts again from 0 after a restart of the watch. */
    fun walkedSince(start: Long, now: Long): Long = when {
        start < 0 || now < 0 -> 0
        now >= start -> now - start
        else -> now
    }
}

/** What the pet says. A cat says 喵, a dog 汪. */
object Lines {
    fun word(look: Look) = when (look.kind) { Kind.CAT -> "喵"; Kind.DOG -> "汪"; Kind.DRAGON -> "嗚" }

    fun remind(type: RType, look: Look, pick: Int): String {
        val w = word(look)
        val list = when (type) {
            RType.WATER -> listOf("${w}～夠鐘飲啖水啦 💧", "飲杯水先，我陪你 🥛", "口渴未呀？去斟杯水啦 💧")
            RType.REST -> listOf("起身伸個懶腰啦 🙆", "望吓遠處，俾對眼休息 20 秒 👀", "企起身行兩步啦 🚶", "轉吓膊頭，深呼吸一下 🌿")
            RType.TOILET -> listOf("去個廁所先啦，唔好忍呀 🚽", "去完廁所返嚟，我喺度等你 🐾")
        }
        return list[Math.floorMod(pick, list.size)]
    }

    fun thanks(type: RType, day: Day, goal: Int): String = when (type) {
        RType.WATER -> if (day.water >= goal) "好叻！今日飲夠 ${day.water} 杯水喇 🎉" else "好叻！今日飲咗 ${day.water} 杯水 💧"
        RType.REST -> "舒服啲未呀？😸"
        RType.TOILET -> "歡迎返嚟！🐾"
    }

    /** When you stroke it. */
    fun petted(look: Look, pick: Int): String {
        val list = when (look.kind) {
            Kind.CAT -> listOf("喵～ 💗", "呼嚕呼嚕… 😽", "再摸多下啦 🐾", "好舒服呀 💕")
            Kind.DOG -> listOf("汪！💗", "搖尾巴搖到停唔到 🐶", "再嚟多次！🐾", "最鍾意你 💕")
            Kind.DRAGON -> listOf("嗚嚕嚕～ 💗", "（露出冇牙嘅笑容）😁", "再搲吓下巴啦 🐉", "拍吓翼，好開心 💕")
        }
        return list[Math.floorMod(pick, list.size)]
    }

    fun autoRest(steps: Long) = "你行咗 $steps 步，當你休息咗 👍"
    fun later() = "好啦，5 分鐘之後再提你 ⏰"
}
