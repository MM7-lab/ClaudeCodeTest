package hk.mm7lab.watchcat

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import hk.mm7lab.watchcat.core.Lines
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.RType
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

/** The full-screen reminder: the pet asks, you answer. */
class ReminderActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val test = RType.byId(intent.getStringExtra(TEST))
        val type = test ?: Store.timer(this).pending
        if (type == null) { finish(); return }
        setContent { WatchTheme { ReminderScreen(type, test != null) { finish() } } }
    }

    companion object { const val TEST = "test" }
}

@Composable
private fun ReminderScreen(type: RType, test: Boolean, close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    storeVersion()
    val t = clock()
    val s = Store.settings(ctx)
    val mood = Mood.level(Store.today(ctx), s.waterGoal)
    val hearts = remember { Hearts() }
    var thanks by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var pose by remember { mutableStateOf(Actions.poseFor(type)) }
    val ask = remember { if (test) Lines.remind(type, s.look, Random.nextInt(100)) else Store.line(ctx).first.ifEmpty { Lines.remind(type, s.look, 0) } }

    // answered somewhere else (the notification, the tile): nothing left to do here
    val pending = Store.timer(ctx).pending
    LaunchedEffect(pending, thanks, busy) { if (!test && !busy && pending == null && thanks == null) close() }
    LaunchedEffect(thanks) { if (thanks != null) { delay(2600L); close() } }

    fun answer(done: Boolean) {
        if (thanks != null || busy) return
        if (test) { thanks = "試吓咋，唔使做嘢 😸"; pose = Pose.HAPPY; hearts.add(t); return }
        busy = true
        scope.launch {
            Actions.answer(ctx, done)
            thanks = Store.line(ctx).first
            pose = if (done) (if (type == RType.WATER) Pose.WATER else Pose.HAPPY) else Pose.IDLE
            if (done) hearts.add(t)
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Ring(1f, type.color())
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 22.dp)) {
            Text("${type.emoji} ${type.title}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = type.color())
            Box(contentAlignment = Alignment.Center) {
                PetView(s.look, pose, mood, t, Modifier.size(104.dp))
                HeartsView(hearts, t, Modifier.size(104.dp))
            }
            Text(
                "${s.name}：${thanks ?: ask}", fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2,
            )
            if (thanks == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 4.dp)) {
                    Button(
                        onClick = { answer(true) },
                        colors = ButtonDefaults.primaryButtonColors(backgroundColor = RestGreen),
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                    ) { Text("✓", fontSize = 18.sp, color = Color.Black) }
                    Button(
                        onClick = { answer(false) },
                        colors = ButtonDefaults.secondaryButtonColors(),
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                    ) { Text("⏰", fontSize = 16.sp) }
                }
            }
        }
    }
}
