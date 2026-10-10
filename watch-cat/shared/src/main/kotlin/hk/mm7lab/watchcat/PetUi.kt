package hk.mm7lab.watchcat

// Pieces of screen shared by the watch and the phone app.

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.TextUnit
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

/** The animated pet (3D or drawn, as set), with Zzz when it's asleep. */
@Composable
fun PetView(look: Look, pose: Pose, mood: Int, t: Float, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val style3d = Store.settings(ctx).style3d
    // blink for a moment every few seconds (the 3D pictures blink by themselves)
    val blink = if (pose != Pose.SLEEP && (t % 4.3f) < 0.13f) 0f else 1f
    val zPaint = remember {
        android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(170, 190, 255)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
    }
    Canvas(modifier) {
        // a soft glow behind, so dark pets (the black cat, the dragon) stand out on the black screen
        val s0 = minOf(size.width, size.height)
        drawCircle(
            Brush.radialGradient(listOf(Color(0x33B8C8FF), Color.Transparent), center = Offset(size.width / 2, size.height * 0.58f), radius = s0 * 0.5f),
            radius = s0 * 0.5f, center = Offset(size.width / 2, size.height * 0.58f),
        )
        drawIntoCanvas { c ->
            val n = c.nativeCanvas
            val s = minOf(size.width, size.height)
            n.save()
            n.translate((size.width - s) / 2f, (size.height - s) / 2f)
            PetDraw.draw(ctx, n, s, look, Frame(t, pose, blink, mood), style3d)
            if (pose == Pose.SLEEP) {
                // three Zs drifting up from the head
                for (i in 0 until 3) {
                    val k = ((t * 0.5f + i / 3f) % 1f)
                    zPaint.alpha = ((1f - k) * 230).toInt()
                    zPaint.textSize = s * (0.07f + 0.05f * k)
                    n.drawText("Z", s * (0.62f + 0.12f * k), s * (0.38f - 0.22f * k), zPaint)
                }
            }
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
fun HeartsView(h: Hearts, t: Float, modifier: Modifier = Modifier, size: TextUnit = 18.sp, rise: Float = 60f) {
    Box(modifier, contentAlignment = Alignment.Center) {
        h.born.forEachIndexed { i, b ->
            val age = t - b
            if (age in 0f..1.6f) {
                val x = sin(b * 7f + i) * rise * 0.55f
                BasicText(
                    "💗", style = TextStyle(fontSize = size),
                    modifier = Modifier.offset(x = x.dp, y = (-rise / 3f - age * rise).dp).alpha((1f - age / 1.6f).coerceIn(0f, 1f)),
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
