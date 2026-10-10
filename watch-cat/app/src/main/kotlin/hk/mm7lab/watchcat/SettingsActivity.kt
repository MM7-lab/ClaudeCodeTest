package hk.mm7lab.watchcat

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.ToggleChip
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Settings

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WatchTheme { SettingsScreen() } }
    }
}

fun pick(ctx: Context, what: String) = ctx.startActivity(Intent(ctx, PickActivity::class.java).putExtra(PickActivity.WHAT, what))

@Composable
fun Toggle(label: String, checked: Boolean, secondary: String? = null, onChange: (Boolean) -> Unit) = ToggleChip(
    checked = checked,
    onCheckedChange = onChange,
    label = { Text(label, maxLines = 2) },
    secondaryLabel = if (secondary != null) { { Text(secondary, maxLines = 1) } } else null,
    toggleControl = { Switch(checked = checked) },
    modifier = Modifier.fillMaxWidth(),
)

@Composable
fun Choice(label: String, value: String, icon: (@Composable BoxScope.() -> Unit)? = null, onClick: () -> Unit) = Chip(
    onClick = onClick,
    label = { Text(label, maxLines = 1) },
    secondaryLabel = { Text(value, maxLines = 1) },
    icon = icon,
    colors = ChipDefaults.secondaryChipColors(),
    modifier = Modifier.fillMaxWidth(),
)

@Composable
private fun SettingsScreen() {
    val ctx = LocalContext.current
    storeVersion()
    val s = Store.settings(ctx)
    fun set(n: Settings) = Actions.changeSettings(ctx, n)
    val state = rememberScalingLazyListState()

    Scaffold(timeText = { TimeText() }) {
        ScalingLazyColumn(state = state, modifier = Modifier.fillMaxWidth()) {
            item { ListHeader { Text("設定") } }
            item {
                Choice("寵物", s.look.label, icon = {
                    Image(
                        PetBitmap.of(ctx, s.look, Frame(0.4f), 96).asImageBitmap(), null,
                        Modifier.size(ChipDefaults.LargeIconSize),
                    )
                }) { pick(ctx, PickActivity.PET) }
            }
            item { Choice("名字", s.name) { pick(ctx, PickActivity.NAME) } }
            item { Toggle("🧊 3D 樣式", s.style3d, if (s.style3d) "同電腦版一樣嘅 3D 寵物" else "平面公仔畫") { set(s.copy(style3d = it)) } }
            item { Choice("幾耐提一次", "每 ${s.intervalMin} 分鐘") { pick(ctx, PickActivity.INTERVAL) } }

            item { ListHeader { Text("提醒") } }
            item { Toggle("💧 飲水", s.water) { set(s.copy(water = it)) } }
            item { Toggle("🙆 休息", s.rest) { set(s.copy(rest = it)) } }
            item { Toggle("🚽 去廁所", s.toilet) { set(s.copy(toilet = it)) } }
            item { Choice("每日飲水目標", "${s.waterGoal} 杯") { pick(ctx, PickActivity.GOAL) } }

            item { ListHeader { Text("夜晚") } }
            item { Toggle("🌙 夜間靜音", s.quietOn, "%02d:00 – %02d:00".format(s.quietStart, s.quietEnd)) { set(s.copy(quietOn = it)) } }
            if (s.quietOn) {
                item { Choice("由", "%02d:00".format(s.quietStart)) { pick(ctx, PickActivity.QUIET_START) } }
                item { Choice("至", "%02d:00".format(s.quietEnd)) { pick(ctx, PickActivity.QUIET_END) } }
            }

            item { ListHeader { Text("行路") } }
            item {
                Toggle("🚶 行路當休息", s.walkAsRest, if (Steps.allowed(ctx)) "行夠 ${s.stepsForRest} 步" else "要俾「體能活動」權限") {
                    set(s.copy(walkAsRest = it))
                }
            }
            if (s.walkAsRest) item { Choice("要行幾多步", "${s.stepsForRest} 步") { pick(ctx, PickActivity.STEPS) } }

            item { ListHeader { Text("其他") } }
            item { Toggle("📳 強力震動", s.strongBuzz) { set(s.copy(strongBuzz = it)) } }
            item { Toggle("⏸ 暫停提醒", s.paused) { set(s.copy(paused = it)) } }
            item {
                Chip(
                    onClick = { Actions.test(ctx) },
                    label = { Text("🔔 試吓提醒") },
                    secondaryLabel = { Text("震一下，睇吓個樣") },
                    colors = ChipDefaults.primaryChipColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Text(
                    "手錶貓貓 ${BuildConfigInfo.version(ctx)}\n震法：💧兩下短 · 🙆一下長 · 🚽三下快",
                    fontSize = 10.sp, color = Dim, textAlign = TextAlign.Center,
                )
            }
        }
    }
}

object BuildConfigInfo {
    fun version(ctx: Context): String =
        runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: ""
}
