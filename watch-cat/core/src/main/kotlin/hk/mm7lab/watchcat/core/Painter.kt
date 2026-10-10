package hk.mm7lab.watchcat.core

/**
 * A tiny drawing interface, so the pet can be drawn the same way on the watch (Android Canvas)
 * and in previews on a computer (Java2D). Colours are ARGB ints.
 */
interface Painter {
    fun save()
    fun restore()
    fun translate(x: Float, y: Float)
    fun rotate(degrees: Float)
    fun scale(sx: Float, sy: Float)

    /** A filled ellipse, with an optional outline. */
    fun ellipse(cx: Float, cy: Float, rx: Float, ry: Float, fill: Int, stroke: Int? = null, width: Float = 0f)

    /** A path, filled and/or stroked (round joins and caps). */
    fun path(shape: Shape, fill: Int? = null, stroke: Int? = null, width: Float = 0f)

    /** An open arc of a circle, stroked with round caps (angles in degrees, 0 = 3 o'clock, clockwise). */
    fun arc(cx: Float, cy: Float, r: Float, startDeg: Float, sweepDeg: Float, color: Int, width: Float)
}

/** A path built from straight lines and curves. */
class Shape {
    sealed class Op {
        data class Move(val x: Float, val y: Float) : Op()
        data class Line(val x: Float, val y: Float) : Op()
        data class Quad(val cx: Float, val cy: Float, val x: Float, val y: Float) : Op()
        data class Cubic(val c1x: Float, val c1y: Float, val c2x: Float, val c2y: Float, val x: Float, val y: Float) : Op()
        object Close : Op()
    }

    val ops = mutableListOf<Op>()
    fun moveTo(x: Float, y: Float) = apply { ops += Op.Move(x, y) }
    fun lineTo(x: Float, y: Float) = apply { ops += Op.Line(x, y) }
    fun quadTo(cx: Float, cy: Float, x: Float, y: Float) = apply { ops += Op.Quad(cx, cy, x, y) }
    fun cubicTo(c1x: Float, c1y: Float, c2x: Float, c2y: Float, x: Float, y: Float) = apply { ops += Op.Cubic(c1x, c1y, c2x, c2y, x, y) }
    fun close() = apply { ops += Op.Close }
}

/** Opaque colour from 0xRRGGBB. */
fun rgb(hex: Long): Int = (0xFF000000 or hex).toInt()

/** Same colour with a different alpha (0..1). */
fun Int.alpha(a: Float): Int = ((a.coerceIn(0f, 1f) * 255).toInt() shl 24) or (this and 0xFFFFFF)

/** Mix two colours (k = 0 gives this, 1 gives other). */
fun Int.mix(other: Int, k: Float): Int {
    fun ch(c: Int, s: Int) = (c shr s) and 0xFF
    fun m(s: Int) = (ch(this, s) + (ch(other, s) - ch(this, s)) * k).toInt().coerceIn(0, 255)
    return (m(24) shl 24) or (m(16) shl 16) or (m(8) shl 8) or m(0)
}
