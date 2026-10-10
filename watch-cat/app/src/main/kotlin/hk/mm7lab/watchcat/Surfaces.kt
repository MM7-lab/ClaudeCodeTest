package hk.mm7lab.watchcat

import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester

/** The watch's tile and complication. */
object Surfaces {
    fun refresh(ctx: Context) {
        runCatching { TileService.getUpdater(ctx).requestUpdate(PetTileService::class.java) }
        runCatching {
            ComplicationDataSourceUpdateRequester
                .create(ctx, ComponentName(ctx, PetComplicationService::class.java))
                .requestUpdateAll()
        }
    }
}
