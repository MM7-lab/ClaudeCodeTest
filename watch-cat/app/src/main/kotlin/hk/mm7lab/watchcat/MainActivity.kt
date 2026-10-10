package hk.mm7lab.watchcat

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Text
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.MIN
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.RType
import hk.mm7lab.watchcat.core.Reminders
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate

class MainActivity : ComponentActivity() {
    private val ask = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        Scheduler.ensure(this)
        Actions.refresh(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Scheduler.ensure(this)
        if (!Store.asked(this)) {
            Store.setAsked(this)
            val want = mutableListOf(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= 33) want += Manifest.permission.POST_NOTIFICATIONS
            ask.launch(want.toTypedArray())
        }
        setContent { WatchTheme { Home() } }
    }

    override fun onResume() {
        super.onResume()
        Actions.refresh(this)
    }
}

@Composable
private fun Home() {
    val pager = rememberPagerState { 2 }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        VerticalPager(pager, Modifier.fillMaxSize()) { page ->
            if (page == 0) PetPage() else TodayPage()
        }
        // page dots on the right
        Column(
            Modifier.align(Alignment.CenterEnd).padding(end = 5.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            repeat(2) { i ->
                Box(
                    Modifier.size(5.dp).clip(CircleShape)
                        .background(if (pager.currentPage == i) Color.White else Color(0xFF555A60)),
                )
            }
        }
    }
}

@Composable
private fun PetPage() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    storeVersion()
    val now = ticker(1000L)
    val t = clock()
    val hearts = remember { Hearts() }
    val s = Store.settings(ctx)
    val timer = Store.timer(ctx)
    val day = Store.today(ctx)
    val mood = Mood.level(day, s.waterGoal)
    val pose = poseNow(ctx, now)
    val next = Reminders.upcoming(s, timer.orderIdx)?.first
    val quiet = Reminders.inQuiet(s, now, Store.zone)

    // the ring: how much of the wait is left
    val pending = timer.pending
    val frac = when {
        pending != null || s.paused || next == null -> 0f
        else -> (timer.nextAt - now).toFloat() / (s.intervalMin * MIN)
    }
    val (line, lineAt) = Store.line(ctx)
    val showLine = line.isNotEmpty() && now - lineAt < 8000L

    // mood 1 and up: a heart now and then
    val tNow = rememberUpdatedState(t)
    val heartsOn = mood >= 1 && pose != Pose.SLEEP
    LaunchedEffect(heartsOn) {
        while (heartsOn) { delay(9000L); hearts.add(tNow.value) }
    }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Ring(frac, (pending ?: next)?.color() ?: Dim)
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            val top = when {
                s.paused -> "⏸ 提醒暫停咗"
                pending != null -> "${pending.emoji} 等緊你${pending.label}！"
                quiet -> "🌙 ${s.name}瞓緊覺"
                next != null -> "${next.emoji} ${hhmm(timer.nextAt)} ${next.label}"
                else -> "冇開任何提醒"
            }
            Text(top, fontSize = 13.sp, color = (pending ?: next)?.color() ?: Dim, maxLines = 1)
            Box(contentAlignment = Alignment.Center) {
                PetView(
                    s.look, pose, mood, t,
                    Modifier.size(118.dp).clickable(
                        interactionSource = remember { MutableInteractionSource() }, indication = null,
                    ) {
                        Actions.pet(ctx)
                        hearts.add(t)
                    },
                )
                HeartsView(hearts, t, Modifier.size(118.dp))
            }
            if (pending != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { scope.launch { Actions.answer(ctx, true) } },
                        colors = ButtonDefaults.primaryButtonColors(backgroundColor = RestGreen),
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                    ) { Text("✓", fontSize = 18.sp, color = Color.Black) }
                    Button(
                        onClick = { scope.launch { Actions.answer(ctx, false) } },
                        colors = ButtonDefaults.secondaryButtonColors(),
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                    ) { Text("⏰", fontSize = 16.sp) }
                }
            } else {
                Text(
                    if (showLine) line else "${s.name} · ${Mood.NAMES[mood]}",
                    fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 30.dp),
                )
            }
        }
    }
}

@Composable
private fun TodayPage() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    storeVersion()
    val s = Store.settings(ctx)
    val stats = Store.stats(ctx)
    val day = stats.today(Store.date())
    val mood = Mood.level(day, s.waterGoal)
    val (prog, need) = Mood.progress(day, s.waterGoal)

    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("今日", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text(
            "💧${day.water}/${s.waterGoal}  🙆${day.rest}  🚽${day.toilet}  🐾${day.pets}",
            fontSize = 13.sp, maxLines = 1,
        )
        if (day.walks > 0) Text("（行路當休息 ${day.walks} 次）", fontSize = 10.sp, color = Dim)
        Spacer(Modifier.height(4.dp))
        Text("開心指數：${Mood.NAMES[mood]}", fontSize = 12.sp, color = Pink)
        Box(Modifier.width(110.dp).height(5.dp).clip(RoundedCornerShape(3.dp)).background(Color(0xFF2A2D33))) {
            Box(Modifier.fillMaxWidth(prog.coerceIn(0f, 1f)).height(5.dp).background(Pink))
        }
        if (need > 0) Text("再 $need 分：${Mood.UNLOCKS[mood + 1]}", fontSize = 10.sp, color = Dim, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        WeekBars(stats.days.map { it.date to it.water }, s.waterGoal)
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(
                onClick = { scope.launch { Actions.addWater(ctx) } },
                label = { Text("+1 💧", fontSize = 12.sp) },
                colors = ChipDefaults.primaryChipColors(backgroundColor = WaterBlue.copy(alpha = 0.35f)),
                modifier = Modifier.height(36.dp),
            )
            Chip(
                onClick = { ctx.startActivity(Intent(ctx, SettingsActivity::class.java)) },
                label = { Text("⚙️ 設定", fontSize = 12.sp) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.height(36.dp),
            )
        }
    }
}

/** Cups of water over the last 7 days. */
@Composable
private fun WeekBars(days: List<Pair<String, Int>>, goal: Int) {
    val today = LocalDate.now(Store.zone)
    val values = (6 downTo 0).map { back ->
        val d = today.minusDays(back.toLong()).toString()
        days.firstOrNull { it.first == d }?.second ?: 0
    }
    val names = listOf("一", "二", "三", "四", "五", "六", "日")
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Canvas(Modifier.width(120.dp).height(30.dp)) {
            val top = maxOf(goal, values.maxOrNull() ?: 0, 1).toFloat()
            val bw = size.width / 7f
            // the goal line
            val gy = size.height * (1f - goal / top)
            drawLine(Color(0xFF555A60), Offset(0f, gy), Offset(size.width, gy), strokeWidth = 1f)
            values.forEachIndexed { i, v ->
                val h = size.height * v / top
                drawRoundRect(
                    if (v >= goal) WaterBlue else WaterBlue.copy(alpha = 0.5f),
                    Offset(i * bw + bw * 0.2f, size.height - h), Size(bw * 0.6f, h),
                    CornerRadius(3f, 3f),
                )
            }
        }
        Row(Modifier.width(120.dp)) {
            (6 downTo 0).forEach { back ->
                Text(
                    names[today.minusDays(back.toLong()).dayOfWeek.value - 1],
                    fontSize = 8.sp, color = if (back == 0) Color.White else Dim,
                    textAlign = TextAlign.Center, modifier = Modifier.weight(1f),
                )
            }
        }
    }
}
