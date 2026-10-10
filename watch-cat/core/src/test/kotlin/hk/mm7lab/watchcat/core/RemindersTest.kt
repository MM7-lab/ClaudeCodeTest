package hk.mm7lab.watchcat.core

import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RemindersTest {
    private val zone = ZoneId.of("Asia/Hong_Kong")
    private fun at(h: Int, m: Int = 0) = ZonedDateTime.of(2026, 10, 10, h, m, 0, 0, zone).toInstant().toEpochMilli()
    private fun hourOf(ms: Long) = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(ms), zone).hour
    private val s = Settings()

    @Test fun cycleGoesWaterRestWaterToilet() {
        var t = Reminders.restart(s, Timer(), at(10), 0, zone)
        val seen = mutableListOf<RType>()
        var now = at(10)
        repeat(4) {
            now = t.nextAt
            val step = Reminders.onAlarm(s, t, now, 0, zone)
            val r = assertIs<Outcome.Remind>(step.outcome)
            seen += r.type
            t = Reminders.answer(s, step.timer, true, now, 0, zone)
        }
        assertEquals(listOf(RType.WATER, RType.REST, RType.WATER, RType.TOILET), seen)
    }

    @Test fun nextIsOneIntervalLater() {
        val t = Reminders.restart(s, Timer(), at(10), 0, zone)
        assertEquals(at(10, 30), t.nextAt)
    }

    @Test fun disabledTypesAreSkipped() {
        val only = s.copy(water = false, toilet = false)
        assertEquals(RType.REST to 1, Reminders.upcoming(only, 0))
        assertNull(Reminders.upcoming(s.copy(water = false, rest = false, toilet = false), 0))
    }

    @Test fun nothingAtNight() {
        // 22:45 + 30 min falls at 23:15, inside 23:00–08:00: wait until 08:00
        val next = Reminders.nextFire(s, at(22, 45), zone)
        assertEquals(at(8, 0) + 24 * 60 * MIN, next)
        val step = Reminders.onAlarm(s, Timer(nextAt = at(23, 30)), at(23, 30), 0, zone)
        assertIs<Outcome.Quiet>(step.outcome)
        assertEquals(8, hourOf(step.timer.nextAt))
    }

    @Test fun quietWindowWithinTheDay() {
        val lunch = s.copy(quietStart = 13, quietEnd = 14)
        assertTrue(Reminders.inQuiet(lunch, at(13, 20), zone))
        assertTrue(!Reminders.inQuiet(lunch, at(14, 0), zone))
    }

    @Test fun walkingCountsAsRest() {
        // the cycle is at "rest", and 350 steps since the wait began
        val t = Timer(orderIdx = 1, nextAt = at(11), stepsAtStart = 1000)
        val step = Reminders.onAlarm(s, t, at(11), 1350, zone)
        assertEquals(Outcome.AutoRest(350), step.outcome)
        assertEquals(2, step.timer.orderIdx)
        assertNull(step.timer.pending)
        // not enough steps: a normal reminder
        assertIs<Outcome.Remind>(Reminders.onAlarm(s, t, at(11), 1100, zone).outcome)
        // walking doesn't count when switched off
        assertIs<Outcome.Remind>(Reminders.onAlarm(s.copy(walkAsRest = false), t, at(11), 1350, zone).outcome)
    }

    @Test fun stepCounterResetAfterRestart() {
        assertEquals(300, Reminders.walkedSince(5000, 300))
        assertEquals(0, Reminders.walkedSince(-1, 300))
    }

    @Test fun nagsThreeTimesThenLetsGo() {
        var step = Reminders.onAlarm(s, Timer(nextAt = at(10)), at(10), 0, zone)
        assertIs<Outcome.Remind>(step.outcome)
        var now = at(10)
        repeat(3) {
            now += 5 * MIN
            step = Reminders.onAlarm(s, step.timer, now, 0, zone)
            assertIs<Outcome.Nag>(step.outcome)
        }
        now += 5 * MIN
        step = Reminders.onAlarm(s, step.timer, now, 0, zone)
        assertIs<Outcome.None>(step.outcome)
        assertNull(step.timer.pending)
        assertEquals(now + 30 * MIN, step.timer.nextAt)
    }

    @Test fun laterMeansSameReminderInFiveMinutes() {
        val step = Reminders.onAlarm(s, Timer(nextAt = at(10)), at(10), 0, zone)
        val t = Reminders.answer(s, step.timer, false, at(10, 1), 0, zone)
        assertEquals(at(10, 6), t.nextAt)
        assertEquals(RType.WATER, assertIs<Outcome.Remind>(Reminders.onAlarm(s, t, at(10, 6), 0, zone).outcome).type)
    }

    @Test fun pausedDoesNothing() {
        assertIs<Outcome.None>(Reminders.onAlarm(s.copy(paused = true), Timer(nextAt = at(10)), at(10), 0, zone).outcome)
    }
}

class StatsTest {
    @Test fun keepsSevenDaysAndCounts() {
        var st = Stats()
        for (d in 1..9) st = st.update("2026-10-%02d".format(d)) { it.add(RType.WATER) }
        assertEquals(7, st.days.size)
        assertEquals("2026-10-03", st.days.first().date)
        st = st.update("2026-10-09") { it.add(RType.WATER).copy(pets = it.pets + 2) }
        assertEquals(2, st.today("2026-10-09").water)
        assertEquals(Day("2026-10-10"), st.today("2026-10-10"))
        assertEquals(st, Stats.decode(st.encode()))
    }

    @Test fun moodOnlyGoesUp() {
        val goal = 8
        assertEquals(0, Mood.level(Day("d"), goal))
        assertEquals(1, Mood.level(Day("d", water = 2), goal))
        assertEquals(2, Mood.level(Day("d", water = 3, rest = 2), goal))
        assertEquals(3, Mood.level(Day("d", water = 8, rest = 2), goal))
        // pets help, up to 10 a day
        assertEquals(Mood.points(Day("d", pets = 10), goal), Mood.points(Day("d", pets = 50), goal))
        val (k, need) = Mood.progress(Day("d", water = 1), goal)
        assertEquals(0.5f, k); assertEquals(10, need)
    }

    @Test fun settingsRoundTrip() {
        val s = Settings(petId = "golden", name = "布丁", intervalMin = 45, toilet = false, quietStart = 22, strongBuzz = true)
        val m = Codec.settings(s)
        assertEquals(s, Codec.settings { m[it] })
        // bad values fall back to defaults
        assertEquals(30, Codec.settings { if (it == "intervalMin") "7" else null }.intervalMin)
        val t = Timer(orderIdx = 2, nextAt = 123, pending = RType.TOILET, pendingIdx = 3, nags = 1, stepsAtStart = 99)
        val tm = Codec.timer(t)
        assertEquals(t, Codec.timer { tm[it] })
    }
}
