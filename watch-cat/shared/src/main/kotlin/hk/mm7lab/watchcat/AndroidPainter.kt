package hk.mm7lab.watchcat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import hk.mm7lab.watchcat.core.Frame
import hk.mm7lab.watchcat.core.Look
import hk.mm7lab.watchcat.core.Painter
import hk.mm7lab.watchcat.core.PetArt
import hk.mm7lab.watchcat.core.Shape
import java.io.ByteArrayOutputStream

/** Draws the pet with an Android Canvas (the same drawing as the previews made on a computer). */
class AndroidPainter(private val c: Canvas) : Painter {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val rect = RectF()

    override fun save() { c.save() }
    override fun restore() { c.restore() }
    override fun translate(x: Float, y: Float) = c.translate(x, y)
    override fun rotate(degrees: Float) = c.rotate(degrees)
    override fun scale(sx: Float, sy: Float) = c.scale(sx, sy)

    override fun ellipse(cx: Float, cy: Float, rx: Float, ry: Float, fill: Int, stroke: Int?, width: Float) {
        rect.set(cx - rx, cy - ry, cx + rx, cy + ry)
        if (stroke != null && width > 0) { line.color = stroke; line.strokeWidth = width; c.drawOval(rect, line) }
        this.fill.color = fill
        c.drawOval(rect, this.fill)
        if (stroke != null && width > 0) { line.strokeWidth = width * 0.5f; c.drawOval(rect, line) }
    }

    override fun path(shape: Shape, fill: Int?, stroke: Int?, width: Float) {
        val p = Path()
        for (op in shape.ops) when (op) {
            is Shape.Op.Move -> p.moveTo(op.x, op.y)
            is Shape.Op.Line -> p.lineTo(op.x, op.y)
            is Shape.Op.Quad -> p.quadTo(op.cx, op.cy, op.x, op.y)
            is Shape.Op.Cubic -> p.cubicTo(op.c1x, op.c1y, op.c2x, op.c2y, op.x, op.y)
            Shape.Op.Close -> p.close()
        }
        if (fill != null) { this.fill.color = fill; c.drawPath(p, this.fill) }
        if (stroke != null && width > 0) { line.color = stroke; line.strokeWidth = width; c.drawPath(p, line) }
    }

    override fun arc(cx: Float, cy: Float, r: Float, startDeg: Float, sweepDeg: Float, color: Int, width: Float) {
        rect.set(cx - r, cy - r, cx + r, cy + r)
        line.color = color
        line.strokeWidth = width
        c.drawArc(rect, startDeg, sweepDeg, false, line)
    }
}

/** Draws the pet into a square of [size] pixels at (0, 0): the 3D picture if there is one, else the drawing. */
object PetDraw {
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val src = android.graphics.Rect()
    private val dst = RectF()

    fun draw(ctx: Context, c: Canvas, size: Float, look: Look, frame: Frame, style3d: Boolean) {
        val m = if (style3d) Sprites.meta(ctx)?.takeIf { it.has(look.id) } else null
        val sheet = m?.let { Sprites.sheet(ctx, look.id, frame.pose) }
        if (m == null || sheet == null) {
            c.save()
            c.scale(size / 200f, size / 200f)
            PetArt.draw(AndroidPainter(c), look, frame)
            c.restore()
            return
        }
        val i = Sprites.frameAt(m, frame.t)
        dst.set(0f, 0f, size, size)
        c.drawBitmap(sheet, Sprites.src(m, i, src), dst, paint)
        if (frame.mood >= 2) m.head(look.id, frame.pose, i)?.let { h ->
            c.save()
            c.scale(size / m.cell, size / m.cell)
            PetArt.accessories(AndroidPainter(c), frame.mood, h[0], h[1], h[2], h[3], h[4])
            c.restore()
        }
    }
}

/** The pet as a picture, for the tile and the pet chooser. */
object PetBitmap {
    private val cache = HashMap<String, Bitmap>()

    fun of(ctx: Context, look: Look, frame: Frame, size: Int): Bitmap {
        val style3d = Store.settings(ctx).style3d
        val key = "${look.id}-${frame.pose}-${frame.mood}-$size-$style3d"
        return cache.getOrPut(key) {
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            // the first frame of the loop (eyes open)
            PetDraw.draw(ctx, Canvas(bmp), size.toFloat(), look, frame.copy(t = 0f), style3d)
            bmp
        }
    }

    fun png(ctx: Context, look: Look, frame: Frame, size: Int): ByteArray =
        ByteArrayOutputStream().also { of(ctx, look, frame, size).compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
}
