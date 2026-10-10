package hk.mm7lab.watchcat

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DeviceParametersBuilders.DeviceParameters
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.ChipColors
import androidx.wear.protolayout.material.CircularProgressIndicator
import androidx.wear.protolayout.material.CompactChip
import androidx.wear.protolayout.material.ProgressIndicatorColors
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Looks
import hk.mm7lab.watchcat.core.MIN
import hk.mm7lab.watchcat.core.Mood
import hk.mm7lab.watchcat.core.Pose
import hk.mm7lab.watchcat.core.RType
import hk.mm7lab.watchcat.core.Reminders
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future

/**
 * The tile (資訊卡): the pet, a ring counting down to the next reminder, today's water, and a
 * button for one more cup (or to answer the reminder that's waiting).
 */
class PetTileService : TileService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    override fun onTileRequest(req: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> = scope.future {
        val now = System.currentTimeMillis()
        val clicked = req.currentState.lastClickableId
        // a tap on the button (ignore the same tap coming back twice)
        if ((clicked == WATER || clicked == DONE) && now - Store.lastTileWater > 1500L) {
            Store.lastTileWater = now
            if (clicked == DONE) Actions.answer(this@PetTileService, true) else Actions.addWater(this@PetTileService)
        }
        tile(req.deviceConfiguration)
    }

    override fun onTileResourcesRequest(req: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        scope.future {
            // the version says which picture: "pet id / pose / mood"
            val parts = req.version.split('/')
            val look = Looks.byId(parts.getOrNull(0) ?: "")
            val pose = runCatching { Pose.valueOf(parts.getOrNull(1) ?: "") }.getOrDefault(Pose.IDLE)
            val mood = parts.getOrNull(2)?.toIntOrNull() ?: 0
            val png = PetBitmap.png(this@PetTileService, look, Frame(0.4f, pose, 1f, mood), IMG)
            ResourceBuilders.Resources.Builder()
                .setVersion(req.version)
                .addIdToImageMapping(
                    PET,
                    ResourceBuilders.ImageResource.Builder()
                        .setInlineResource(
                            ResourceBuilders.InlineImageResource.Builder()
                                .setData(png)
                                .setWidthPx(IMG)
                                .setHeightPx(IMG)
                                .setFormat(ResourceBuilders.IMAGE_FORMAT_UNDEFINED)
                                .build(),
                        )
                        .build(),
                )
                .build()
        }

    private fun text(s: String, color: Int, typography: Int = Typography.TYPOGRAPHY_CAPTION1) =
        Text.Builder(this, s).setTypography(typography).setColor(argb(color)).setMaxLines(1).build()

    private fun tile(device: DeviceParameters): TileBuilders.Tile {
        val ctx = this
        val now = System.currentTimeMillis()
        val s = Store.settings(ctx)
        val t = Store.timer(ctx)
        val day = Store.today(ctx)
        val mood = Mood.level(day, s.waterGoal)
        val pending = t.pending
        val next = Reminders.upcoming(s, t.orderIdx)?.first
        val quiet = Reminders.inQuiet(s, now, Store.zone)
        val color = (pending ?: next)?.argb() ?: GREY
        val frac = if (pending != null || s.paused || next == null) 0f
        else ((t.nextAt - now).toFloat() / (s.intervalMin * MIN)).coerceIn(0f, 1f)
        val pose = when {
            pending != null -> Actions.poseFor(pending)
            s.paused || quiet -> Pose.SLEEP
            mood >= 3 -> Pose.DANCE
            mood >= 1 -> Pose.HAPPY
            else -> Pose.IDLE
        }
        val version = "${s.petId}/${pose.name}/$mood/${if (s.style3d) "3d" else "2d"}"

        val top = when {
            s.paused -> "⏸ 暫停咗"
            pending != null -> "${pending.emoji} 等緊你${pending.label}！"
            quiet -> "🌙 ${s.name}瞓緊覺"
            next != null -> "下次 ${next.emoji} ${hhmm(t.nextAt)}"
            else -> s.name
        }

        val openApp = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build(),
                    )
                    .build(),
            )
            .build()

        val chipId = if (pending != null) DONE else WATER
        val chipText = if (pending != null) "搞掂 ✓" else "+1 杯水"
        val chipColor = if (pending != null) (pending.argb()) else WATER_BLUE
        val chip = CompactChip.Builder(
            ctx, chipText,
            ModifiersBuilders.Clickable.Builder().setId(chipId).setOnClick(ActionBuilders.LoadAction.Builder().build()).build(),
            device,
        ).setChipColors(ChipColors(chipColor, 0xFF000000.toInt())).build()

        val ring = CircularProgressIndicator.Builder()
            .setProgress(frac)
            .setStartAngle(0f)
            .setEndAngle(360f)
            .setStrokeWidth(dp(6f))
            .setCircularProgressIndicatorColors(ProgressIndicatorColors(argb(color), argb(TRACK)))
            .build()

        val image = LayoutElementBuilders.Image.Builder()
            .setResourceId(PET)
            .setWidth(dp(76f))
            .setHeight(dp(76f))
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openApp).build())
            .build()

        val column = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(text(top, color))
            .addContent(image)
            .addContent(text("💧 ${day.water}/${s.waterGoal}   ${Mood.NAMES[mood]}", 0xFFFFFFFF.toInt()))
            .addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build())
            .addContent(chip)
            .build()

        val root = LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .addContent(ring)
            .addContent(column)
            .build()

        return TileBuilders.Tile.Builder()
            .setResourcesVersion(version)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
            .setFreshnessIntervalMillis(60_000L)
            .build()
    }

    private fun RType.argb(): Int = when (this) {
        RType.WATER -> WATER_BLUE
        RType.REST -> 0xFF81C784.toInt()
        RType.TOILET -> 0xFFFFB74D.toInt()
    }

    companion object {
        private const val PET = "pet"
        private const val WATER = "water"
        private const val DONE = "done"
        private const val IMG = 160
        private val WATER_BLUE = 0xFF4FC3F7.toInt()
        private val GREY = 0xFF9AA0A6.toInt()
        private val TRACK = 0xFF2A2D33.toInt()
    }
}
