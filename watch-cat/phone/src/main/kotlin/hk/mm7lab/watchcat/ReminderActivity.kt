package hk.mm7lab.watchcat

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
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
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val test = RType.byId(intent.getStringExtra(TEST))
        val type = test ?: Store.timer(this).pending
        if (type == null) { finish(); return }
        setContent { PhoneTheme { ReminderScreen(type, test != null) { finish() } } }
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

    // answered somewhere else (the notification, the widget): nothing left to do here
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

    Box(Modifier.fillMaxSize().background(Color(0xFF15161C)), contentAlignment = Alignment.Center) {
        Column(
            Modifier.fillMaxWidth().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("${type.emoji} ${type.title}", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = type.color())
            Box(Modifier.fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
                Ring(1f, type.color(), Modifier.fillMaxSize())
                PetView(s.look, pose, mood, t, Modifier.fillMaxSize(0.84f))
                HeartsView(hearts, t, Modifier.fillMaxSize(0.84f), size = 28.sp, rise = 110f)
            }
            Text("${s.name}：${thanks ?: ask}", fontSize = 20.sp, color = Color.White, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (thanks == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Button(
                        onClick = { answer(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = RestGreen, contentColor = Color.Black),
                    ) { Text("搞掂 ✓", fontSize = 20.sp) }
                    OutlinedButton(onClick = { answer(false) }) { Text("遲啲先 ⏰", fontSize = 20.sp, color = Color.White) }
                }
            }
        }
    }
}
