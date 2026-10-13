package hk.mm7.ledger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;

import org.junit.Test;

/** Figures for the countdown challenge started 2026-01-01 at $2 a unit (day 1 = $730, day 365 = $2). */
public class ChallengeTest {
    private final Challenge down = new Challenge(true, true, LocalDate.of(2026, 1, 1), 2, 365, 1);

    @Test
    public void totals() {
        assertEquals(286, down.dayOf(LocalDate.of(2026, 10, 13)));
        assertEquals(730, down.need(1, 1), 0.001);
        assertEquals(160, down.need(286, 286), 0.001);
        assertEquals(127270, down.need(1, 286), 0.001);
        assertEquals(133590, down.need(1, 365), 0.001);
        assertEquals(125034, down.need(1, 273), 0.001);
    }

    @Test
    public void months() {
        assertEquals(4774, down.monthNeed(YearMonth.of(2026, 10)), 0.001);
        assertEquals(2790, down.monthNeed(YearMonth.of(2026, 11)), 0.001);
        assertEquals(992, down.monthNeed(YearMonth.of(2026, 12)), 0.001);
        assertEquals(0, down.monthNeed(YearMonth.of(2027, 1)), 0.001);
        Challenge up = new Challenge(true, false, LocalDate.of(2026, 1, 1), 2, 365, 1);
        assertEquals(17918, up.monthNeed(YearMonth.of(2026, 10)), 0.001);
    }

    @Test
    public void reminders() {
        assertEquals(LocalDateTime.of(2026, 11, 1, 9, 0), down.nextReminder(LocalDateTime.of(2026, 10, 13, 10, 0)));
        assertEquals(LocalDateTime.of(2026, 10, 1, 9, 0), down.nextReminder(LocalDateTime.of(2026, 10, 1, 8, 0)));
        assertNull(down.nextReminder(LocalDateTime.of(2026, 12, 2, 9, 0)));
        Challenge later = new Challenge(true, true, LocalDate.of(2026, 3, 15), 2, 365, 5);
        assertEquals(LocalDateTime.of(2026, 3, 5, 9, 0).plusMonths(1), later.nextReminder(LocalDateTime.of(2026, 3, 10, 0, 0)));
        assertEquals(LocalDateTime.of(2026, 3, 5, 9, 0), later.nextReminder(LocalDateTime.of(2026, 1, 1, 0, 0)));
    }
}
