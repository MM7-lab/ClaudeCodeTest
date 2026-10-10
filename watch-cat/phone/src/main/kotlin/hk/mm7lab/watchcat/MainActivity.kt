package hk.mm7lab.watchcat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Kind
import hk.mm7lab.watchcat.core.Looks
import hk.mm7lab.watchcat.core.MIN
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.Reminders
import hk.mm7lab.watchcat.core.Settings
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate

class MainActivity : ComponentActivity() {
    private val ask = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        Scheduler.ensure(this)
        Actions.refresh(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        Scheduler.ensure(this)
        if (!Store.asked(this)) {
            Store.setAsked(this)
            val want = mutableListOf(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= 33) want += Manifest.permission.POST_NOTIFICATIONS
            ask.launch(want.toTypedArray())
        }
        setContent { PhoneTheme { App() } }
    }

    override fun onResume() {
        super.onResume()
        Actions.refresh(this)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App() {
    var settings by rememberSaveable { mutableStateOf(false) }
    BackHandler(enabled = settings) { settings = false }
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(if (settings) "設定" else "手機貓貓", fontWeight = FontWeight.Bold) },
                navigationIcon = { if (settings) TextButton(onClick = { settings = false }) { Text("‹ 返回", fontSize = 16.sp) } },
                actions = { if (!settings) TextButton(onClick = { settings = true }) { Text("⚙️ 設定", fontSize = 16.sp) } },
            )
        },
    ) { pad ->
        if (settings) SettingsScreen(pad) else Home(pad)
    }
}

// ---------------------------------------------------------------- home

@Composable
private fun Home(pad: PaddingValues) {
    Column(
        Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        PetCard()
        TodayCard()
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun PetCard() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    storeVersion()
    val now = ticker(1000L)
    val t = clock()
    val hearts = remember { Hearts() }
    val s = Store.settings(ctx)
    val timer = Store.timer(ctx)
    val mood = Mood.level(Store.today(ctx), s.waterGoal)
    val pose = poseNow(ctx, now)
    val next = Reminders.upcoming(s, timer.orderIdx)?.first
    val pending = timer.pending
    val quiet = Reminders.inQuiet(s, now, Store.zone)
    val frac = if (pending != null || s.paused || next == null) 0f else (timer.nextAt - now).toFloat() / (s.intervalMin * MIN)
    val (line, lineAt) = Store.line(ctx)
    val showLine = line.isNotEmpty() && now - lineAt < 10_000L

    // mood 1 and up: a heart now and then
    val tNow = rememberUpdatedState(t)
    val heartsOn = mood >= 1 && pose != Pose.SLEEP
    LaunchedEffect(heartsOn) { while (heartsOn) { delay(9000L); hearts.add(tNow.value) } }

    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1B1D25)),
    ) {
        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val color = (pending ?: next)?.color() ?: Dim
            Text(
                when {
                    s.paused -> "⏸ 提醒暫停咗"
                    pending != null -> "${pending.emoji} 等緊你${pending.label}！"
                    quiet -> "🌙 ${s.name}瞓緊覺"
                    next != null -> "下次 ${next.emoji} ${hhmm(timer.nextAt)} ${next.label}"
                    else -> "冇開任何提醒"
                },
                color = color, fontSize = 17.sp, fontWeight = FontWeight.Bold,
            )
            Box(Modifier.fillMaxWidth().aspectRatio(1f).padding(8.dp), contentAlignment = Alignment.Center) {
                Ring(frac, color, Modifier.fillMaxSize())
                PetView(
                    s.look, pose, mood, t,
                    Modifier.fillMaxSize(0.84f).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                        Actions.pet(ctx)
                        hearts.add(t)
                    },
                )
                HeartsView(hearts, t, Modifier.fillMaxSize(0.84f), size = 28.sp, rise = 110f)
            }
            Text(
                if (showLine) "${s.name}：$line" else "${s.name} · 開心指數：${Mood.NAMES[mood]}",
                color = Color.White, fontSize = 16.sp, textAlign = TextAlign.Center,
                modifier = Modifier.heightIn(min = 44.dp),
            )
            Spacer(Modifier.height(12.dp))
            if (pending != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = { scope.launch { Actions.answer(ctx, true) } },
                        colors = ButtonDefaults.buttonColors(containerColor = RestGreen, contentColor = Color.Black),
                    ) { Text("搞掂 ✓", fontSize = 17.sp) }
                    OutlinedButton(onClick = { scope.launch { Actions.answer(ctx, false) } }) { Text("遲啲先 ⏰", fontSize = 17.sp, color = Color.White) }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = { scope.launch { Actions.addWater(ctx) } },
                        colors = ButtonDefaults.buttonColors(containerColor = WaterBlue, contentColor = Color.Black),
                    ) { Text("+1 杯水 💧", fontSize = 16.sp) }
                    OutlinedButton(onClick = { Actions.test(ctx) }) { Text("🔔 試吓提醒", fontSize = 16.sp, color = Color.White) }
                }
            }
        }
    }
}

@Composable
private fun TodayCard() {
    val ctx = LocalContext.current
    storeVersion()
    val s = Store.settings(ctx)
    val stats = Store.stats(ctx)
    val day = stats.today(Store.date())
    val mood = Mood.level(day, s.waterGoal)
    val (prog, need) = Mood.progress(day, s.waterGoal)
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("今日", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                Stat("💧", "${day.water}/${s.waterGoal}", "飲水")
                Stat("🙆", "${day.rest}", "休息")
                Stat("🚽", "${day.toilet}", "去廁所")
                Stat("🐾", "${day.pets}", "摸咗")
            }
            if (day.walks > 0) Text("行路當休息咗 ${day.walks} 次 🚶", color = MaterialTheme.colorScheme.onSurfaceVariant)
            HorizontalDivider()
            Text("開心指數：${Mood.NAMES[mood]}", fontWeight = FontWeight.Bold, color = Pink)
            LinearProgressIndicator(
                progress = { prog.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                color = Pink,
            )
            Text(
                if (need > 0) "再 $need 分：${Mood.UNLOCKS[mood + 1]}" else "已經最開心喇 👑",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp,
            )
            HorizontalDivider()
            Text("過去 7 日飲水", fontWeight = FontWeight.Bold)
            WeekBars(stats.days.map { it.date to it.water }, s.waterGoal)
        }
    }
}

@Composable
private fun Stat(emoji: String, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emoji, fontSize = 26.sp)
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun WeekBars(days: List<Pair<String, Int>>, goal: Int) {
    val today = LocalDate.now(Store.zone)
    val values = (6 downTo 0).map { back -> days.firstOrNull { it.first == today.minusDays(back.toLong()).toString() }?.second ?: 0 }
    val names = listOf("一", "二", "三", "四", "五", "六", "日")
    val line = MaterialTheme.colorScheme.outlineVariant
    Column {
        Canvas(Modifier.fillMaxWidth().height(90.dp)) {
            val top = maxOf(goal, values.maxOrNull() ?: 0, 1).toFloat()
            val bw = size.width / 7f
            val gy = size.height * (1f - goal / top)
            drawLine(line, Offset(0f, gy), Offset(size.width, gy), strokeWidth = 2f)
            values.forEachIndexed { i, v ->
                val h = size.height * v / top
                drawRoundRect(
                    if (v >= goal) WaterBlue else WaterBlue.copy(alpha = 0.5f),
                    Offset(i * bw + bw * 0.22f, size.height - h), Size(bw * 0.56f, h), CornerRadius(8f, 8f),
                )
            }
        }
        Row(Modifier.fillMaxWidth()) {
            (6 downTo 0).forEach { back ->
                Text(
                    names[today.minusDays(back.toLong()).dayOfWeek.value - 1] + "\n" + values[6 - back],
                    fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.weight(1f),
                    fontWeight = if (back == 0) FontWeight.Bold else FontWeight.Normal,
                )
            }
        }
    }
}

// ---------------------------------------------------------------- settings

@Composable
private fun SettingsScreen(pad: PaddingValues) {
    val ctx = LocalContext.current
    storeVersion()
    val s = Store.settings(ctx)
    fun set(n: Settings) = Actions.changeSettings(ctx, n)
    var dialog by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf(s.name) }

    LazyColumn(Modifier.fillMaxSize().padding(pad), contentPadding = PaddingValues(bottom = 32.dp)) {
        item { Header("寵物") }
        item {
            ListItem(
                headlineContent = { Text("揀寵物") },
                supportingContent = { Text(s.look.label) },
                leadingContent = { Image(PetBitmap.of(ctx, s.look, Frame(0.4f), 160).asImageBitmap(), null, Modifier.size(56.dp)) },
                modifier = Modifier.clickable { dialog = "pet" },
            )
        }
        item {
            OutlinedTextField(
                value = name,
                onValueChange = { v -> name = v.take(12); if (v.isNotBlank()) set(Store.settings(ctx).copy(name = v.trim().take(12))) },
                label = { Text("名字") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        item { SwitchRow("🧊 3D 樣式", if (s.style3d) "同電腦版一樣嘅 3D 寵物" else "平面公仔畫", s.style3d) { set(s.copy(style3d = it)) } }

        item { Header("提醒") }
        item { ChoiceRow("幾耐提一次", "每 ${s.intervalMin} 分鐘") { dialog = "interval" } }
        item { SwitchRow("💧 飲水", null, s.water) { set(s.copy(water = it)) } }
        item { SwitchRow("🙆 休息", null, s.rest) { set(s.copy(rest = it)) } }
        item { SwitchRow("🚽 去廁所", null, s.toilet) { set(s.copy(toilet = it)) } }
        item { ChoiceRow("每日飲水目標", "${s.waterGoal} 杯") { dialog = "goal" } }

        item { Header("夜晚") }
        item { SwitchRow("🌙 夜間靜音", "%02d:00 – %02d:00 唔會提".format(s.quietStart, s.quietEnd), s.quietOn) { set(s.copy(quietOn = it)) } }
        if (s.quietOn) {
            item { ChoiceRow("由", "%02d:00".format(s.quietStart)) { dialog = "quietStart" } }
            item { ChoiceRow("至", "%02d:00".format(s.quietEnd)) { dialog = "quietEnd" } }
        }

        item { Header("行路") }
        item {
            SwitchRow("🚶 行路當休息", if (Steps.allowed(ctx)) "夠鐘休息嗰陣，如果已經行咗 ${s.stepsForRest} 步，就當休息咗" else "要喺手機設定俾「體能活動」權限", s.walkAsRest) {
                set(s.copy(walkAsRest = it))
            }
        }
        if (s.walkAsRest) item { ChoiceRow("要行幾多步", "${s.stepsForRest} 步") { dialog = "steps" } }

        item { Header("其他") }
        item { SwitchRow("📳 強力震動", "震耐啲、大力啲", s.strongBuzz) { set(s.copy(strongBuzz = it)) } }
        item { SwitchRow("⏸ 暫停提醒", null, s.paused) { set(s.copy(paused = it)) } }
        item { ChoiceRow("🔔 試吓提醒", "震一下，睇吓提醒畫面") { Actions.test(ctx) } }
        item { BatteryRow() }
        item {
            Text(
                "手機貓貓 ${versionName(ctx)}\n震法：💧 兩下短 · 🙆 一下長 · 🚽 三下快\n加小工具：長按主畫面 → 小工具 → 手機貓貓",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(24.dp),
            )
        }
    }

    when (dialog) {
        "pet" -> PetPicker(s.petId, { dialog = null }) { id -> set(s.copy(petId = id)); dialog = null }
        "interval" -> Pick("幾耐提一次", Settings.INTERVALS.map { it to "每 $it 分鐘" }, s.intervalMin, { dialog = null }) { set(s.copy(intervalMin = it)) }
        "goal" -> Pick("每日飲水目標", (4..12).map { it to "$it 杯" }, s.waterGoal, { dialog = null }) { set(s.copy(waterGoal = it)) }
        "quietStart" -> Pick("幾點開始靜音", (0..23).map { it to "%02d:00".format(it) }, s.quietStart, { dialog = null }) { set(s.copy(quietStart = it)) }
        "quietEnd" -> Pick("幾點完", (0..23).map { it to "%02d:00".format(it) }, s.quietEnd, { dialog = null }) { set(s.copy(quietEnd = it)) }
        "steps" -> Pick("要行幾多步", listOf(100, 150, 200, 300, 500, 1000).map { it to "$it 步" }, s.stepsForRest, { dialog = null }) { set(s.copy(stepsForRest = it)) }
    }
}

@Composable
private fun Header(text: String) = Text(
    text, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 14.sp,
    modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 4.dp),
)

@Composable
private fun SwitchRow(label: String, sub: String?, checked: Boolean, onChange: (Boolean) -> Unit) = ListItem(
    headlineContent = { Text(label) },
    supportingContent = if (sub != null) { { Text(sub) } } else null,
    trailingContent = { Switch(checked = checked, onCheckedChange = onChange) },
    modifier = Modifier.clickable { onChange(!checked) },
)

@Composable
private fun ChoiceRow(label: String, value: String, onClick: () -> Unit) = ListItem(
    headlineContent = { Text(label) },
    supportingContent = { Text(value) },
    modifier = Modifier.clickable(onClick = onClick),
)

@Composable
private fun <T> Pick(title: String, options: List<Pair<T, String>>, current: T, dismiss: () -> Unit, choose: (T) -> Unit) {
    AlertDialog(
        onDismissRequest = dismiss,
        confirmButton = { TextButton(onClick = dismiss) { Text("取消") } },
        title = { Text(title) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                items(options) { (v, label) ->
                    Row(
                        Modifier.fillMaxWidth().clickable { choose(v); dismiss() }.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = v == current, onClick = { choose(v); dismiss() })
                        Text(label, fontSize = 17.sp)
                    }
                }
            }
        },
    )
}

@Composable
private fun PetPicker(current: String, dismiss: () -> Unit, choose: (String) -> Unit) {
    val ctx = LocalContext.current
    AlertDialog(
        onDismissRequest = dismiss,
        confirmButton = { TextButton(onClick = dismiss) { Text("取消") } },
        title = { Text("揀寵物") },
        text = {
            LazyVerticalGrid(GridCells.Fixed(3), Modifier.heightIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(Looks.ALL) { look ->
                    val sel = look.id == current
                    Column(
                        Modifier.clip(RoundedCornerShape(16.dp))
                            .background(if (sel) MaterialTheme.colorScheme.primary.copy(alpha = 0.18f) else Color.Transparent)
                            .border(if (sel) 2.dp else 0.dp, if (sel) MaterialTheme.colorScheme.primary else Color.Transparent, RoundedCornerShape(16.dp))
                            .clickable { choose(look.id) }.padding(6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Image(PetBitmap.of(ctx, look, Frame(0.4f), 200).asImageBitmap(), null, Modifier.fillMaxWidth().aspectRatio(1f))
                        Text(
                            (when (look.kind) { Kind.CAT -> "🐱 "; Kind.DOG -> "🐶 "; Kind.DRAGON -> "🐉 " }) + look.label,
                            fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2,
                        )
                    }
                }
            }
        },
    )
}

/** Samsung phones put apps to sleep to save battery, which can hold reminders up. */
@Composable
private fun BatteryRow() {
    val ctx = LocalContext.current
    val pm = ctx.getSystemService(PowerManager::class.java)
    val free = pm?.isIgnoringBatteryOptimizations(ctx.packageName) == true
    ListItem(
        headlineContent = { Text("🔋 電池：唔好限制") },
        supportingContent = {
            Text(if (free) "已經設好，提醒會準時 👍" else "撳呢度，揀「允許」，咁手機慳電嗰陣都會準時提你")
        },
        colors = ListItemDefaults.colors(),
        modifier = Modifier.clickable(enabled = !free) {
            runCatching {
                ctx.startActivity(
                    Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}")),
                )
            }
        },
    )
}

private fun versionName(ctx: Context): String =
    runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: ""
