package hk.mm7lab.watchcat

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

/** The pet as a picture, for the tile and the pet chooser. */
object PetBitmap {
    private val cache = HashMap<String, Bitmap>()

    fun of(look: Look, frame: Frame, size: Int): Bitmap {
        val key = "${look.id}-${frame.pose}-${frame.mood}-$size"
        return cache.getOrPut(key) {
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            c.scale(size / 200f, size / 200f)
            PetArt.draw(AndroidPainter(c), look, frame)
            bmp
        }
    }

    fun png(look: Look, frame: Frame, size: Int): ByteArray =
        ByteArrayOutputStream().also { of(look, frame, size).compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
}
