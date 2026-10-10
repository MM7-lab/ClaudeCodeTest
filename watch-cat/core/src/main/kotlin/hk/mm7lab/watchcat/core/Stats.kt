package hk.mm7lab.watchcat.core

import kotlin.math.min

/** One day's record. [walks] counts the rests that walking took care of (they're in [rest] too). */
data class Day(
    val date: String,
    val water: Int = 0,
    val rest: Int = 0,
    val toilet: Int = 0,
    val pets: Int = 0,
    val walks: Int = 0,
) {
    fun add(type: RType) = when (type) {
        RType.WATER -> copy(water = water + 1)
        RType.REST -> copy(rest = rest + 1)
        RType.TOILET -> copy(toilet = toilet + 1)
    }
}

/** The last 7 days, oldest first. */
data class Stats(val days: List<Day> = emptyList()) {
    fun today(date: String): Day = days.lastOrNull()?.takeIf { it.date == date } ?: Day(date)

    /** Change today's record, starting a new day (and dropping the oldest) when the date changes. */
    fun update(date: String, f: (Day) -> Day): Stats {
        val rest = days.filter { it.date != date }
        return Stats((rest + f(today(date))).sortedBy { it.date }.takeLast(7))
    }

    fun encode(): String = days.joinToString(";") { "${it.date},${it.water},${it.rest},${it.toilet},${it.pets},${it.walks}" }

    companion object {
        fun decode(s: String?): Stats = Stats(
            s.orEmpty().split(';').mapNotNull { row ->
                val f = row.split(',')
                if (f.size < 5) return@mapNotNull null
                val n = f.drop(1).map { it.toIntOrNull() ?: 0 }
                Day(f[0], n[0], n[1], n[2], n[3], n.getOrElse(4) { 0 })
            },
        )
    }
}

/**
 * The pet's mood (開心指數). It only goes up: looking after yourself and petting it make it
 * happier through the day, and it starts calm again each morning. It is never sad.
 */
object Mood {
    val NAMES = listOf("平靜", "開心", "好開心", "超開心")
    val UNLOCKS = listOf("", "會搖尾同出心心", "頭上會有花 🌸", "戴皇冠 👑，仲會跳舞")
    private val LEVELS = listOf(0, 20, 50, 90)

    fun points(d: Day, goal: Int): Int =
        (d.water + d.rest + d.toilet) * 10 + min(d.pets, 10) * 2 + if (d.water >= goal) 20 else 0

    fun level(d: Day, goal: Int): Int = LEVELS.indexOfLast { points(d, goal) >= it }.coerceAtLeast(0)

    /** Progress (0..1) towards the next level, and the points still needed. */
    fun progress(d: Day, goal: Int): Pair<Float, Int> {
        val p = points(d, goal)
        val lv = level(d, goal)
        if (lv >= LEVELS.size - 1) return 1f to 0
        val from = LEVELS[lv]
        val to = LEVELS[lv + 1]
        return (p - from).toFloat() / (to - from) to (to - p)
    }
}

/** Settings and timer to and from plain key/value text (for SharedPreferences). */
object Codec {
    fun settings(get: (String) -> String?): Settings {
        val d = Settings()
        fun b(k: String, def: Boolean) = get(k)?.toBooleanStrictOrNull() ?: def
        fun i(k: String, def: Int) = get(k)?.toIntOrNull() ?: def
        return Settings(
            petId = get("petId")?.takeIf { id -> Looks.ALL.any { it.id == id } } ?: d.petId,
            name = get("name")?.takeIf { it.isNotBlank() }?.take(12) ?: d.name,
            intervalMin = i("intervalMin", d.intervalMin).takeIf { it in Settings.INTERVALS } ?: d.intervalMin,
            water = b("water", d.water), rest = b("rest", d.rest), toilet = b("toilet", d.toilet),
            quietOn = b("quietOn", d.quietOn),
            quietStart = i("quietStart", d.quietStart).coerceIn(0, 23),
            quietEnd = i("quietEnd", d.quietEnd).coerceIn(0, 23),
            walkAsRest = b("walkAsRest", d.walkAsRest),
            stepsForRest = i("stepsForRest", d.stepsForRest).coerceIn(50, 2000),
            waterGoal = i("waterGoal", d.waterGoal).coerceIn(1, 20),
            strongBuzz = b("strongBuzz", d.strongBuzz),
            paused = b("paused", d.paused),
            style3d = b("style3d", d.style3d),
        )
    }

    fun settings(s: Settings): Map<String, String> = mapOf(
        "petId" to s.petId, "name" to s.name, "intervalMin" to s.intervalMin.toString(),
        "water" to s.water.toString(), "rest" to s.rest.toString(), "toilet" to s.toilet.toString(),
        "quietOn" to s.quietOn.toString(), "quietStart" to s.quietStart.toString(), "quietEnd" to s.quietEnd.toString(),
        "walkAsRest" to s.walkAsRest.toString(), "stepsForRest" to s.stepsForRest.toString(),
        "waterGoal" to s.waterGoal.toString(), "strongBuzz" to s.strongBuzz.toString(), "paused" to s.paused.toString(),
        "style3d" to s.style3d.toString(),
    )

    fun timer(get: (String) -> String?): Timer = Timer(
        orderIdx = get("t.orderIdx")?.toIntOrNull()?.coerceIn(0, ORDER.size - 1) ?: 0,
        nextAt = get("t.nextAt")?.toLongOrNull() ?: 0L,
        pending = RType.byId(get("t.pending")),
        pendingIdx = get("t.pendingIdx")?.toIntOrNull()?.coerceIn(0, ORDER.size - 1) ?: 0,
        nags = get("t.nags")?.toIntOrNull() ?: 0,
        stepsAtStart = get("t.stepsAtStart")?.toLongOrNull() ?: -1L,
    )

    fun timer(t: Timer): Map<String, String> = mapOf(
        "t.orderIdx" to t.orderIdx.toString(), "t.nextAt" to t.nextAt.toString(), "t.pending" to (t.pending?.id ?: ""),
        "t.pendingIdx" to t.pendingIdx.toString(), "t.nags" to t.nags.toString(), "t.stepsAtStart" to t.stepsAtStart.toString(),
    )
}
