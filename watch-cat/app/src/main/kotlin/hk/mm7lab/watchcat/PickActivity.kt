package hk.mm7lab.watchcat

import android.app.RemoteInput
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.input.RemoteInputIntentHelper
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Look
import hk.mm7lab.watchcat.core.Looks
import hk.mm7lab.watchcat.core.Settings

/** A list to choose one setting from. */
class PickActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val what = intent.getStringExtra(WHAT) ?: PET
        setContent { WatchTheme { PickScreen(what) { finish() } } }
    }

    companion object {
        const val WHAT = "what"
        const val PET = "pet"
        const val NAME = "name"
        const val INTERVAL = "interval"
        const val GOAL = "goal"
        const val QUIET_START = "quietStart"
        const val QUIET_END = "quietEnd"
        const val STEPS = "steps"
        val NAMES = listOf("麻糬", "波波", "豆豆", "布甸", "芝麻", "團團", "毛毛", "咕咕", "小白", "花花", "旺財", "Lucky")
    }
}

private class Option(val label: String, val selected: Boolean, val look: Look? = null, val apply: (Settings) -> Settings)

@Composable
private fun PickScreen(what: String, done: () -> Unit) {
    val ctx = LocalContext.current
    val s = Store.settings(ctx)
    fun choose(o: Option) { Actions.changeSettings(ctx, o.apply(s)); done() }

    val keyboard = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val text = r.data?.let { RemoteInput.getResultsFromIntent(it) }?.getCharSequence("name")?.toString()?.trim()
        if (!text.isNullOrEmpty()) { Actions.changeSettings(ctx, s.copy(name = text.take(12))); done() }
    }

    val (title, options) = when (what) {
        PickActivity.PET -> "揀寵物" to Looks.ALL.map { l -> Option(l.label, l.id == s.petId, l) { it.copy(petId = l.id) } }
        PickActivity.NAME -> "改名" to PickActivity.NAMES.map { n -> Option(n, n == s.name) { it.copy(name = n) } }
        PickActivity.INTERVAL -> "幾耐提一次" to Settings.INTERVALS.map { m -> Option("每 $m 分鐘", m == s.intervalMin) { it.copy(intervalMin = m) } }
        PickActivity.GOAL -> "每日飲水目標" to (4..12).map { n -> Option("$n 杯", n == s.waterGoal) { it.copy(waterGoal = n) } }
        PickActivity.QUIET_START -> "幾點開始靜音" to (0..23).map { h -> Option("%02d:00".format(h), h == s.quietStart) { it.copy(quietStart = h) } }
        PickActivity.QUIET_END -> "幾點完" to (0..23).map { h -> Option("%02d:00".format(h), h == s.quietEnd) { it.copy(quietEnd = h) } }
        else -> "要行幾多步" to listOf(100, 150, 200, 300, 500, 1000).map { n -> Option("$n 步", n == s.stepsForRest) { it.copy(stepsForRest = n) } }
    }
    // start with the current choice in the middle of the screen
    val start = options.indexOfFirst { it.selected }.coerceAtLeast(0) + 1
    val state = rememberScalingLazyListState(initialCenterItemIndex = start)

    Scaffold(timeText = { TimeText() }) {
        ScalingLazyColumn(state = state, modifier = Modifier.fillMaxWidth()) {
            item { ListHeader { Text(title) } }
            if (what == PickActivity.NAME) {
                item {
                    Chip(
                        onClick = {
                            val i = RemoteInputIntentHelper.createActionRemoteInputIntent()
                            RemoteInputIntentHelper.putRemoteInputsExtra(i, listOf(RemoteInput.Builder("name").setLabel("改個名").build()))
                            keyboard.launch(i)
                        },
                        label = { Text("✏️ 自己打") },
                        colors = ChipDefaults.primaryChipColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            items(options) { o ->
                Chip(
                    onClick = { choose(o) },
                    label = { Text(if (o.selected) "✓ ${o.label}" else o.label, maxLines = 1) },
                    icon = o.look?.let { l ->
                        {
                            Image(
                                PetBitmap.of(l, Frame(0.4f), 96).asImageBitmap(), null,
                                Modifier.size(ChipDefaults.LargeIconSize),
                            )
                        }
                    },
                    colors = if (o.selected) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
