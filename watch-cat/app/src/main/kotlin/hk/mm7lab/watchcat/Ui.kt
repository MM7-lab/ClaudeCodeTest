package hk.mm7lab.watchcat

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.offset
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Look
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.RType
import hk.mm7lab.watchcat.core.Reminders
import kotlinx.coroutines.delay
import kotlin.math.sin

val WaterBlue = Color(0xFF4FC3F7)
val RestGreen = Color(0xFF81C784)
val ToiletOrange = Color(0xFFFFB74D)
val Pink = Color(0xFFFF8FA6)
val Dim = Color(0xFF9AA0A6)

fun RType.color() = when (this) {
    RType.WATER -> WaterBlue
    RType.REST -> RestGreen
    RType.TOILET -> ToiletOrange
}

@Composable
fun WatchTheme(content: @Composable () -> Unit) =
    MaterialTheme(colors = Colors(primary = Color(0xFFF3A35C), secondary = WaterBlue), content = content)

/** A number that ticks up every so often, so the screen keeps up with the clock. */
@Composable
fun ticker(ms: Long): Long {
    var now by remember { androidx.compose.runtime.mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(ms) { while (true) { delay(ms); now = System.currentTimeMillis() } }
    return now
}

/** Seconds since the screen opened, about 30 times a second. */
@Composable
fun clock(): Float {
    var t by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        val start = System.nanoTime()
        while (true) { delay(33); t = (System.nanoTime() - start) / 1e9f }
    }
    return t
}

/** Re-read the store whenever it changes. */
@Composable
fun storeVersion(): Long = Store.changes.collectAsState().value

/** The animated pet. */
@Composable
fun PetView(look: Look, pose: Pose, mood: Int, t: Float, modifier: Modifier = Modifier) {
    // blink for a moment every few seconds
    val blink = if (pose != Pose.SLEEP && (t % 4.3f) < 0.13f) 0f else 1f
    Canvas(modifier) {
        drawIntoCanvas { c ->
            val n = c.nativeCanvas
            n.save()
            val k = minOf(size.width, size.height) / 200f
            n.translate((size.width - 200f * k) / 2f, (size.height - 200f * k) / 2f)
            n.scale(k, k)
            hk.mm7lab.watchcat.core.PetArt.draw(AndroidPainter(n), look, Frame(t, pose, blink, mood))
            n.restore()
        }
    }
}

/** Hearts that float up and fade. Add one with [Hearts.add]. */
class Hearts {
    val born = mutableStateListOf<Float>()
    fun add(t: Float) { born += t; if (born.size > 8) born.removeAt(0) }
}

@Composable
fun HeartsView(h: Hearts, t: Float, modifier: Modifier = Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        h.born.forEachIndexed { i, b ->
            val age = t - b
            if (age in 0f..1.6f) {
                val x = sin(b * 7f + i) * 34f
                Text(
                    "💗", fontSize = 18.sp,
                    color = Color.White.copy(alpha = (1f - age / 1.6f).coerceIn(0f, 1f)),
                    modifier = Modifier.offset(x = x.dp, y = (-20f - age * 60f).dp),
                )
            }
        }
    }
}

/** The countdown ring round the edge of the screen. [frac] is how much of the wait is left. */
@Composable
fun Ring(frac: Float, color: Color, modifier: Modifier = Modifier.fillMaxSize()) {
    Canvas(modifier) {
        val w = 7.dp.toPx()
        val inset = w / 2 + 2.dp.toPx()
        val tl = Offset(inset, inset)
        val sz = Size(size.width - inset * 2, size.height - inset * 2)
        drawArc(Color(0xFF2A2D33), 0f, 360f, false, tl, sz, style = Stroke(w))
        drawArc(color, -90f, 360f * frac.coerceIn(0f, 1f), false, tl, sz, style = Stroke(w, cap = StrokeCap.Round))
    }
}

/** What the pet should be doing right now. */
fun poseNow(ctx: Context, now: Long): Pose {
    val s = Store.settings(ctx)
    val t = Store.timer(ctx)
    t.pending?.let { return Actions.poseFor(it) }
    val (act, at) = Store.act(ctx)
    if (act != Pose.IDLE && now - at < 4500L) return act
    if (s.paused || Reminders.inQuiet(s, now, Store.zone)) return Pose.SLEEP
    val mood = Mood.level(Store.today(ctx), s.waterGoal)
    val sec = (now / 1000L) % 30L
    if (mood >= 3 && sec < 6) return Pose.DANCE
    if (mood >= 1 && sec in 12L..14L) return Pose.HAPPY
    return Pose.IDLE
}

fun hhmm(at: Long): String {
    val z = java.time.Instant.ofEpochMilli(at).atZone(Store.zone)
    return "%02d:%02d".format(z.hour, z.minute)
}
