package hk.mm7lab.watchcat

import android.app.PendingIntent
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

/** The complication (小部件) for a watch face: cups of water today, against the day's goal. */
class PetComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val tap = PendingIntent.getActivity(
            this, 30, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return data(request.complicationType, Store.today(this).water, Store.settings(this).waterGoal, tap)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? = data(type, 3, 8, null)

    private fun data(type: ComplicationType, water: Int, goal: Int, tap: PendingIntent?): ComplicationData? {
        val icon = MonochromaticImage.Builder(Icon.createWithResource(this, R.drawable.ic_water)).build()
        val desc = PlainComplicationText.Builder("今日飲咗 $water 杯水，目標 $goal 杯").build()
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(PlainComplicationText.Builder("$water/$goal").build(), desc)
                .setMonochromaticImage(icon)
                .setTapAction(tap)
                .build()
            ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(
                water.coerceAtMost(goal).toFloat(), 0f, goal.toFloat(), desc,
            )
                .setText(PlainComplicationText.Builder("$water").build())
                .setMonochromaticImage(icon)
                .setTapAction(tap)
                .build()
            else -> null
        }
    }
}
