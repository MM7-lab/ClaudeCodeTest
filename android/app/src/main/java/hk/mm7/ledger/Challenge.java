package hk.mm7.ledger;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

/**
 * The 365-day saving challenge maths, shared with the web page's rules. Counting down (default),
 * day 1 saves days × unit and the last day saves 1 × unit; counting up, day n saves n × unit.
 * Pure Java (no Android or org.json) so it can be unit-tested off-device.
 */
final class Challenge {
    final boolean on;
    final boolean down;
    final LocalDate start;
    final double unit;
    final int days;
    final int remindDay;

    Challenge(boolean on, boolean down, LocalDate start, double unit, int days, int remindDay) {
        this.on = on;
        this.down = down;
        this.start = start;
        this.unit = unit;
        this.days = days;
        this.remindDay = Math.max(1, Math.min(28, remindDay));
    }

    long dayOf(LocalDate d) {
        return ChronoUnit.DAYS.between(start, d) + 1;
    }

    private double units(long d) {
        return down ? days + 1 - d : d;
    }

    /** Amount for days a..b inclusive (clipped to the challenge). */
    double need(long a, long b) {
        a = Math.max(1, a);
        b = Math.min(days, b);
        if (b < a) return 0;
        return unit * (units(a) + units(b)) * (b - a + 1) / 2;
    }

    /** First and last challenge day falling in this month, or null if none. */
    long[] range(YearMonth ym) {
        long a = Math.max(1, dayOf(ym.atDay(1)));
        long b = Math.min(days, dayOf(ym.atEndOfMonth()));
        return b < a ? null : new long[]{a, b};
    }

    double monthNeed(YearMonth ym) {
        long[] r = range(ym);
        return r == null ? 0 : need(r[0], r[1]);
    }

    /** The next reminder time (remindDay of a month that still has challenge days, 9:00), or null when the challenge is over. */
    LocalDateTime nextReminder(LocalDateTime now) {
        if (!on) return null;
        YearMonth ym = YearMonth.from(now);
        for (int i = 0; i < 40; i++, ym = ym.plusMonths(1)) {
            if (range(ym) == null) {
                if (ym.isAfter(YearMonth.from(start))) return null;
                continue;
            }
            LocalDateTime t = ym.atDay(remindDay).atTime(9, 0);
            if (t.isAfter(now)) return t;
        }
        return null;
    }
}
