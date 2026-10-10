package hk.mm7lab.watchcat.core

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test

/** Draws every look and pose to PNG files (core/build/previews) to check them by eye. */
class PreviewTest {
    private val dir = File(System.getProperty("previewDir") ?: "build/previews").apply { mkdirs() }

    private fun sheet(name: String, cols: Int, cells: List<Pair<Look, Frame>>, cell: Int = 200) {
        val rows = (cells.size + cols - 1) / cols
        val img = BufferedImage(cols * cell, rows * cell, BufferedImage.TYPE_INT_ARGB)
        val g = img.createGraphics()
        g.color = Color(0x1B1E24); g.fillRect(0, 0, img.width, img.height)
        val p = AwtPainter(g)
        cells.forEachIndexed { i, (look, frame) ->
            p.save()
            p.translate((i % cols) * cell.toFloat(), (i / cols) * cell.toFloat())
            p.scale(cell / 200f, cell / 200f)
            PetArt.draw(p, look, frame)
            p.restore()
        }
        g.dispose()
        ImageIO.write(img, "png", File(dir, "$name.png"))
    }

    @Test fun allLooks() = sheet("looks", 6, Looks.ALL.map { it to Frame(t = 0.4f) })

    @Test fun poses() {
        val poses = Pose.values().toList()
        val cells = listOf("orange", "golden", "siamese", "frenchie").flatMap { id ->
            poses.mapIndexed { i, pose -> Looks.byId(id) to Frame(t = 0.3f + i * 0.2f, pose = pose, mood = i % 4) }
        }
        sheet("poses", poses.size, cells)
    }
}
