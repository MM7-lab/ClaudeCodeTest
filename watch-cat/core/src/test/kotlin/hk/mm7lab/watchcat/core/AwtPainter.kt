package hk.mm7lab.watchcat.core

import java.awt.BasicStroke
import java.awt.Color
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.Arc2D
import java.awt.geom.Ellipse2D
import java.awt.geom.Path2D

/** Draws with Java2D, for previews on a computer. */
class AwtPainter(private val g: Graphics2D) : Painter {
    private val stack = ArrayDeque<java.awt.geom.AffineTransform>()

    init {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE)
    }

    private fun color(c: Int) = Color(c, true)
    private fun stroke(w: Float) = BasicStroke(w, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)

    override fun save() { stack.addLast(g.transform) }
    override fun restore() { g.transform = stack.removeLast() }
    override fun translate(x: Float, y: Float) = g.translate(x.toDouble(), y.toDouble())
    override fun rotate(degrees: Float) = g.rotate(Math.toRadians(degrees.toDouble()))
    override fun scale(sx: Float, sy: Float) = g.scale(sx.toDouble(), sy.toDouble())

    override fun ellipse(cx: Float, cy: Float, rx: Float, ry: Float, fill: Int, stroke: Int?, width: Float) {
        val e = Ellipse2D.Float(cx - rx, cy - ry, rx * 2, ry * 2)
        if (stroke != null && width > 0) { g.color = color(stroke); g.stroke = stroke(width); g.draw(e) }
        g.color = color(fill); g.fill(e)
        if (stroke != null && width > 0) { g.color = color(stroke); g.stroke = stroke(width * 0.5f); g.draw(e) }
    }

    override fun path(shape: Shape, fill: Int?, stroke: Int?, width: Float) {
        val p = Path2D.Float()
        for (op in shape.ops) when (op) {
            is Shape.Op.Move -> p.moveTo(op.x, op.y)
            is Shape.Op.Line -> p.lineTo(op.x, op.y)
            is Shape.Op.Quad -> p.quadTo(op.cx, op.cy, op.x, op.y)
            is Shape.Op.Cubic -> p.curveTo(op.c1x, op.c1y, op.c2x, op.c2y, op.x, op.y)
            Shape.Op.Close -> p.closePath()
        }
        if (fill != null) { g.color = color(fill); g.fill(p) }
        if (stroke != null && width > 0) { g.color = color(stroke); g.stroke = stroke(width); g.draw(p) }
    }

    override fun arc(cx: Float, cy: Float, r: Float, startDeg: Float, sweepDeg: Float, color: Int, width: Float) {
        g.color = color(color); g.stroke = stroke(width)
        g.draw(Arc2D.Float(cx - r, cy - r, r * 2, r * 2, -startDeg, -sweepDeg, Arc2D.OPEN))
    }
}
