package hk.mm7lab.watchcat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.util.LruCache
import hk.mm7lab.watchcat.core.Pose
import org.json.JSONObject

/**
 * The 3D pets: looping animations rendered from the desktop app's model (watch-cat/tools/sprites),
 * one sheet of frames per pet and pose in assets/pets, plus where the head is in every frame.
 */
object Sprites {
    class Meta(val cell: Int, val frames: Int, val cols: Int, val fps: Int, private val looks: JSONObject) {
        fun has(look: String) = looks.has(look)

        /** [topX, topY, midX, midY, r] of the head in frame [i], in the frame's pixels. */
        fun head(look: String, pose: Pose, i: Int): FloatArray? {
            val a = looks.optJSONObject(look)?.optJSONArray(pose.name)?.optJSONArray(i) ?: return null
            return FloatArray(5) { a.optDouble(it).toFloat() }
        }
    }

    private var meta: Meta? = null
    private var tried = false

    fun meta(ctx: Context): Meta? {
        if (!tried) {
            tried = true
            meta = runCatching {
                val j = JSONObject(ctx.assets.open("pets/meta.json").bufferedReader().use { it.readText() })
                Meta(j.getInt("cell"), j.getInt("frames"), j.getInt("cols"), j.optInt("fps", 8), j.getJSONObject("looks"))
            }.getOrNull()
        }
        return meta
    }

    // a decoded sheet is about 5.5 MB; keep the few in use
    private val sheets = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun sheet(ctx: Context, look: String, pose: Pose): Bitmap? {
        val key = "${look}_${pose.name}"
        sheets.get(key)?.let { return it }
        val bmp = runCatching { ctx.assets.open("pets/$key.webp").use { BitmapFactory.decodeStream(it) } }.getOrNull() ?: return null
        sheets.put(key, bmp)
        return bmp
    }

    fun available(ctx: Context, look: String) = meta(ctx)?.has(look) == true

    /** Which frame to show at [t] seconds. */
    fun frameAt(m: Meta, t: Float) = ((t * m.fps).toInt() % m.frames + m.frames) % m.frames

    fun src(m: Meta, i: Int, out: Rect = Rect()): Rect {
        val x = (i % m.cols) * m.cell
        val y = (i / m.cols) * m.cell
        out.set(x, y, x + m.cell, y + m.cell)
        return out
    }
}
