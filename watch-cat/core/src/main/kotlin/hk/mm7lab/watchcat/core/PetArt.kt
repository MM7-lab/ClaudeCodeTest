package hk.mm7lab.watchcat.core

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sin

/** What the pet is doing. */
enum class Pose { IDLE, HAPPY, SLEEP, WATER, REST, TOILET, DANCE }

/**
 * One moment of the animation. [t] is seconds since start (drives breathing, tail, dancing);
 * [blink] is 1 for open eyes, 0 for closed; [mood] is the mood level 0..3 (see Mood).
 */
data class Frame(val t: Float = 0f, val pose: Pose = Pose.IDLE, val blink: Float = 1f, val mood: Int = 0)

private val WHITE = rgb(0xFFFFFF)
private val BLUSH = rgb(0xFF8FA6)
private val TONGUE = rgb(0xFF7F97)
private val MOUTH = rgb(0x8E2F44)
private val GOLD = rgb(0xF6C544)
private val GOLD_DARK = rgb(0xD99A1F)

/**
 * Draws a cat or a dog sitting and facing you, in a 200 × 200 box (floor at y = 188).
 * Scale the painter first to fit the screen.
 */
object PetArt {
    fun draw(p: Painter, look: Look, f: Frame) {
        val o = look.line
        val lw = 3f
        val sleeping = f.pose == Pose.SLEEP
        val dancing = f.pose == Pose.DANCE
        val t = f.t

        p.save()
        // dancing: sway side to side and bounce; otherwise a gentle breath
        val sway = if (dancing) sin(t * 6f) * 7f else 0f
        val bounce = if (dancing) -abs(sin(t * 6f)) * 8f else 0f
        p.translate(100f, 188f + bounce)
        p.rotate(sway)
        p.translate(-100f, -188f)

        val breathe = sin(t * 2.4f) * (if (sleeping) 2.2f else 1.2f)
        val bodyCy = if (sleeping) 156f else 142f
        val bodyRx = 44f * (1 + look.fluff * 0.08f)
        val bodyRy = if (sleeping) 32f else 40f + breathe * 0.5f
        val headCy = (if (sleeping) 112f else 92f) + breathe * 0.4f
        val hw = look.headWide
        val legColor = if (look.pointLegs && look.point != null) look.point else look.fur
        val pawColor = look.paw ?: if (look.pointLegs && look.point != null) look.point else look.belly

        drawTail(p, look, t, f.pose, bodyCy)

        // arms up for a stretch: behind the head
        if (f.pose == Pose.REST) {
            val wave = sin(t * 3f) * 4f
            arm(p, 74f, 130f, 30f, 70f + wave, legColor, pawColor, o)
            arm(p, 126f, 130f, 170f, 70f - wave, legColor, pawColor, o)
        }

        // body, belly, back feet
        p.ellipse(100f, bodyCy, bodyRx, bodyRy, look.fur, o, lw)
        look.saddle?.let { p.ellipse(100f, bodyCy - 10f, bodyRx * 0.86f, bodyRy * 0.62f, it) }
        p.ellipse(100f, bodyCy + 7f, bodyRx * 0.56f, bodyRy * 0.7f, look.belly)
        if (look.fluff > 0f) ruff(p, look, bodyCy)
        for (s in listOf(-1f, 1f)) p.ellipse(100f + s * 31f, 182f, 16f, 8.5f, pawColor, o, lw)

        // front legs (one goes up to hold something when reminding; tucked away when asleep)
        val raised = f.pose == Pose.WATER || f.pose == Pose.TOILET || (dancing && sin(t * 3f) > 0)
        if (!sleeping && f.pose != Pose.REST) {
            leg(p, 84f, bodyCy, legColor, pawColor, o)
            if (!raised) leg(p, 116f, bodyCy, legColor, pawColor, o)
        } else if (sleeping) {
            for (s in listOf(-1f, 1f)) p.ellipse(100f + s * 15f, 184f, 13f, 7.5f, pawColor, o, lw)
        }

        // head
        p.save()
        if (sleeping) { p.translate(100f, headCy); p.rotate(-8f); p.translate(-100f, -headCy) }
        if (f.pose == Pose.HAPPY || dancing) { p.translate(100f, headCy); p.rotate(sin(t * 4f) * 5f); p.translate(-100f, -headCy) }
        ears(p, look, headCy, hw, behind = true)
        p.ellipse(100f, headCy, 50f * hw, 43f, look.fur, o, lw)
        if (look.fluff >= 0.9f) {
            // fluffy cheeks
            for (s in listOf(-1f, 1f)) p.ellipse(100f + s * 44f * hw, headCy + 12f, 12f, 14f, look.fur)
        }
        look.stripe?.let { stripes(p, it, headCy) }
        face(p, look, f, headCy, hw)
        ears(p, look, headCy, hw, behind = false)
        if (f.mood >= 2) flower(p, 100f - 34f * hw, headCy - 34f)
        if (f.mood >= 3) crown(p, headCy)
        p.restore()

        // the raised paw holds a cup of water or a toilet roll
        if (raised) {
            val bob = sin(t * 3f) * 3f
            when (f.pose) {
                Pose.WATER -> cup(p, 158f, 100f + bob, o)
                Pose.TOILET -> toiletRoll(p, 158f, 100f + bob, o)
                else -> {}
            }
            arm(p, 118f, 134f, 150f, 116f + bob, legColor, pawColor, o)
        }
        if (f.pose == Pose.REST) sparkles(p, t)
        p.restore()
    }

    // ---------- parts ----------

    private fun leg(p: Painter, x: Float, bodyCy: Float, fur: Int, paw: Int, o: Int) {
        p.ellipse(x, bodyCy + 20f, 11f, 22f, fur, o, 3f)
        p.ellipse(x, 179f, 12.5f, 8f, paw, o, 3f)
    }

    /** A leg from the shoulder (sx, sy) to a paw at (px, py). */
    private fun arm(p: Painter, sx: Float, sy: Float, px: Float, py: Float, fur: Int, paw: Int, o: Int) {
        val s = Shape().moveTo(sx, sy).lineTo(px, py)
        p.path(s, stroke = o, width = 25f)
        p.path(s, stroke = fur, width = 19f)
        p.ellipse(px, py, 12f, 11f, paw, o, 3f)
    }

    private fun ruff(p: Painter, look: Look, bodyCy: Float) {
        val n = 7
        for (i in 0 until n) {
            val x = 100f + (i - (n - 1) / 2f) * 11f
            p.ellipse(x, bodyCy - 24f + abs(i - 3) * 2.5f, 10f + look.fluff * 3f, 12f + look.fluff * 4f, look.belly)
        }
    }

    private fun drawTail(p: Painter, look: Look, t: Float, pose: Pose, bodyCy: Float) {
        val o = look.line
        val color = look.point ?: look.saddle ?: look.fur
        val happy = pose == Pose.HAPPY || pose == Pose.DANCE || pose == Pose.WATER || pose == Pose.TOILET
        val speed = if (look.kind == Kind.DOG && happy) 14f else if (pose == Pose.SLEEP) 1f else 2.4f
        val amp = if (look.kind == Kind.DOG && happy) 16f else if (pose == Pose.SLEEP) 3f else 8f
        val wag = sin(t * speed) * amp
        p.save()
        p.translate(132f, bodyCy + 22f)
        p.rotate(wag)
        when (look.tail) {
            Tail.STUB -> p.ellipse(4f, -8f, 9f, 8f, color, o, 3f)
            Tail.CURL -> {
                p.ellipse(10f, -40f, 24f, 20f, color, o, 3f)
                p.ellipse(4f, -44f, 13f, 10f, look.belly)
            }
            else -> {
                val w = when (look.tail) { Tail.FLUFFY -> 17f; Tail.THIN -> 7f; Tail.OTTER -> 12f; Tail.PLUME -> 14f; else -> 10f }
                val s = if (look.kind == Kind.CAT)
                    Shape().moveTo(0f, 0f).cubicTo(30f, -6f, 40f, -40f, 22f, -64f)
                else
                    Shape().moveTo(0f, 0f).cubicTo(26f, -4f, 40f, -26f, 38f, -50f)
                p.path(s, stroke = o, width = w + 6f)
                p.path(s, stroke = color, width = w)
                if (look.tail == Tail.PLUME) {
                    val tip = Shape().moveTo(36f, -30f).quadTo(42f, -42f, 38f, -50f)
                    p.path(tip, stroke = look.belly, width = w * 0.55f)
                }
            }
        }
        p.restore()
    }

    private fun stripes(p: Painter, c: Int, headCy: Float) {
        for ((dx, len) in listOf(-11f to 10f, 0f to 13f, 11f to 10f)) {
            p.path(Shape().moveTo(100f + dx, headCy - 40f).lineTo(100f + dx * 0.8f, headCy - 40f + len), stroke = c, width = 4f)
        }
    }

    private fun ears(p: Painter, look: Look, headCy: Float, hw: Float, behind: Boolean) {
        val o = look.line
        val k = look.earScale
        val earColor = look.point ?: look.saddle ?: look.fur
        for (s in listOf(-1f, 1f)) {
            when (look.ears) {
                Ears.FLOPPY -> if (!behind) {
                    // hanging down beside the face
                    p.save()
                    p.translate(100f + s * 44f * hw, headCy - 16f)
                    p.rotate(s * 14f)
                    p.ellipse(0f, 18f * k, 13f * k, 27f * k, look.fur.mix(look.line, 0.12f), o, 3f)
                    p.restore()
                }
                Ears.FOLD -> if (behind) {
                    val cx = 100f + s * 28f * hw
                    p.ellipse(cx, headCy - 36f, 13f, 10f, earColor, o, 3f)
                    p.path(Shape().moveTo(cx - 9f, headCy - 34f).quadTo(cx, headCy - 30f, cx + 9f, headCy - 34f), stroke = o, width = 2f)
                }
                Ears.BAT -> if (behind) {
                    p.save()
                    p.translate(100f + s * 30f * hw, headCy - 38f)
                    p.rotate(s * 24f)
                    p.ellipse(0f, -12f * k, 16f * k, 24f * k, earColor, o, 3f)
                    p.ellipse(0f, -10f * k, 10f * k, 17f * k, look.inner)
                    p.restore()
                }
                else -> if (behind) {
                    val size = when (look.ears) { Ears.SMALL -> 0.72f; Ears.BIG -> 1.3f; Ears.POINTY -> 1.1f; else -> 1f } * k
                    val tall = if (look.ears == Ears.POINTY) 1.25f else 1f
                    val spread = if (look.ears == Ears.SMALL) 36f else 28f
                    val bx = 100f + s * spread * hw
                    val by = headCy - 26f
                    val tri = Shape()
                        .moveTo(bx - s * 18f * size, by + 4f)
                        .quadTo(bx + s * 2f * size, by - 44f * size * tall, bx + s * 10f * size, by - 40f * size * tall)
                        .quadTo(bx + s * 20f * size, by - 12f * size, bx + s * 22f * size, by + 4f)
                        .close()
                    p.path(tri, fill = earColor, stroke = o, width = 3f)
                    val inner = Shape()
                        .moveTo(bx - s * 9f * size, by)
                        .quadTo(bx + s * 3f * size, by - 30f * size * tall, bx + s * 9f * size, by - 30f * size * tall)
                        .quadTo(bx + s * 14f * size, by - 10f * size, bx + s * 13f * size, by)
                        .close()
                    p.path(inner, fill = look.inner)
                }
            }
        }
    }

    private fun face(p: Painter, look: Look, f: Frame, headCy: Float, hw: Float) {
        val o = look.line
        val dog = look.kind == Kind.DOG
        val happy = f.pose == Pose.HAPPY || f.pose == Pose.DANCE
        val talking = f.pose == Pose.WATER || f.pose == Pose.REST || f.pose == Pose.TOILET
        val eyeY = headCy + 2f - look.flat * 2f
        val eyeX = 19f * hw + look.flat * 2f

        // colourpoint mask, a dog's dark muzzle
        look.point?.let { if (!dog) p.ellipse(100f, headCy + 16f, 27f, 19f, it.alpha(0.9f)) }

        // eyes
        for (s in listOf(-1f, 1f)) {
            val x = 100f + s * eyeX
            when {
                f.pose == Pose.SLEEP -> p.path(Shape().moveTo(x - 8f, eyeY).quadTo(x, eyeY + 7f, x + 8f, eyeY), stroke = o, width = 3.2f)
                happy -> p.path(Shape().moveTo(x - 8f, eyeY + 3f).quadTo(x, eyeY - 7f, x + 8f, eyeY + 3f), stroke = o, width = 3.2f)
                f.blink < 0.25f -> p.path(Shape().moveTo(x - 8f, eyeY).lineTo(x + 8f, eyeY), stroke = o, width = 3f)
                else -> {
                    val ry = (if (dog) 8.5f else 10.5f) * max(0.2f, f.blink)
                    if (dog) {
                        p.ellipse(x, eyeY, 7.5f, ry, rgb(0x2A1A10))
                    } else {
                        p.ellipse(x, eyeY, 8.5f, ry, look.eye, o, 1.5f)
                        p.ellipse(x, eyeY, 5f, ry * 0.8f, rgb(0x15110F))
                    }
                    p.ellipse(x + 2.5f, eyeY - ry * 0.35f, 2.6f, 2.6f * max(0.4f, f.blink), WHITE)
                    p.ellipse(x - 2.5f, eyeY + ry * 0.4f, 1.3f, 1.3f * max(0.4f, f.blink), WHITE)
                }
            }
        }

        // blush (rosier when happy)
        val blush = 0.35f + 0.1f * f.mood + if (happy) 0.2f else 0f
        for (s in listOf(-1f, 1f)) p.ellipse(100f + s * 33f * hw, headCy + 15f, 7.5f, 4.5f, BLUSH.alpha(blush))

        val my = headCy + 14f - look.flat * 2f
        if (dog) {
            val muzzle = look.mask ?: look.belly
            p.ellipse(100f, my + 7f, 13f + 7f * look.snout, 12f + 2f * look.snout, muzzle, o, 2.5f)
            p.ellipse(100f, my, 7.5f, 5.5f, look.nose)
            p.ellipse(98f, my - 1.5f, 2.2f, 1.4f, WHITE.alpha(0.7f))
            val open = happy || talking
            p.path(Shape().moveTo(100f, my + 5f).lineTo(100f, my + 10f), stroke = o, width = 2.2f)
            p.path(Shape().moveTo(92f, my + 11f).quadTo(96f, my + 14f, 100f, my + 10f).quadTo(104f, my + 14f, 108f, my + 11f), stroke = o, width = 2.2f)
            if (open) {
                p.ellipse(100f, my + 17f + sin(f.t * 10f) * 0.8f, 5.5f, 7f, TONGUE, o, 1.8f)
            }
        } else {
            val pad = look.point ?: look.belly
            for (s in listOf(-1f, 1f)) p.ellipse(100f + s * 6.5f, my + 4f, 8f, 6.5f, pad)
            val nose = Shape().moveTo(96f, my - 2f).lineTo(104f, my - 2f).lineTo(100f, my + 2.5f).close()
            p.path(nose, fill = look.nose, stroke = look.nose, width = 1.5f)
            if (happy || talking) {
                p.ellipse(100f, my + 9f, 4.5f, 4f + sin(f.t * 9f) * 0.8f, MOUTH)
            } else {
                // a little "ω" mouth
                p.path(Shape().moveTo(93f, my + 5f).quadTo(96.5f, my + 9f, 100f, my + 4f).quadTo(103.5f, my + 9f, 107f, my + 5f), stroke = o, width = 2f)
            }
            // whiskers
            for (s in listOf(-1f, 1f)) for (dy in listOf(-2f, 3f)) {
                p.path(Shape().moveTo(100f + s * 16f, my + 3f + dy * 0.5f).lineTo(100f + s * 40f, my + dy * 2f), stroke = o.alpha(0.5f), width = 1.4f)
            }
        }
    }

    private fun flower(p: Painter, x: Float, y: Float) {
        for (i in 0 until 5) {
            val a = i * 2 * PI.toFloat() / 5
            p.ellipse(x + kotlin.math.cos(a) * 6f, y + sin(a) * 6f, 5f, 5f, rgb(0xFFB3C9), rgb(0xE0688F), 1.2f)
        }
        p.ellipse(x, y, 3.5f, 3.5f, rgb(0xFFE08A))
    }

    private fun crown(p: Painter, headCy: Float) {
        val y = headCy - 46f
        val s = Shape().moveTo(84f, y).lineTo(86f, y - 16f).lineTo(93f, y - 7f).lineTo(100f, y - 19f)
            .lineTo(107f, y - 7f).lineTo(114f, y - 16f).lineTo(116f, y).close()
        p.path(s, fill = GOLD, stroke = GOLD_DARK, width = 2f)
        p.ellipse(100f, y - 19f, 2.8f, 2.8f, rgb(0xFF6F8F))
    }

    private fun cup(p: Painter, x: Float, y: Float, o: Int) {
        val s = Shape().moveTo(x - 11f, y - 14f).lineTo(x + 11f, y - 14f).lineTo(x + 8f, y + 12f).lineTo(x - 8f, y + 12f).close()
        p.path(s, fill = rgb(0xE6F5FF), stroke = o, width = 2.5f)
        p.path(Shape().moveTo(x - 9.5f, y - 4f).lineTo(x + 9.5f, y - 4f).lineTo(x + 8f, y + 11f).lineTo(x - 8f, y + 11f).close(), fill = rgb(0x5FA8E6))
        // a drop jumping out
        val d = Shape().moveTo(x + 4f, y - 32f).quadTo(x + 10f, y - 22f, x + 4f, y - 19f).quadTo(x - 2f, y - 22f, x + 4f, y - 32f).close()
        p.path(d, fill = rgb(0x5FA8E6), stroke = o, width = 1.5f)
    }

    private fun toiletRoll(p: Painter, x: Float, y: Float, o: Int) {
        val body = Shape().moveTo(x - 12f, y - 10f).lineTo(x + 12f, y - 10f).lineTo(x + 12f, y + 12f).lineTo(x - 12f, y + 12f).close()
        p.path(body, fill = WHITE, stroke = o, width = 2.5f)
        p.ellipse(x, y - 10f, 12f, 5f, rgb(0xF4F4F4), o, 2.5f)
        p.ellipse(x, y - 10f, 4f, 2f, rgb(0xC9B79C))
        p.path(Shape().moveTo(x + 12f, y + 4f).lineTo(x + 20f, y + 4f).lineTo(x + 20f, y + 20f).lineTo(x + 12f, y + 20f), fill = WHITE, stroke = o, width = 2f)
    }

    private fun sparkles(p: Painter, t: Float) {
        for ((x, y, ph) in listOf(Triple(40f, 70f, 0f), Triple(162f, 64f, 1.7f), Triple(150f, 30f, 3.1f))) {
            val k = (sin(t * 4f + ph) + 1f) / 2f
            val r = 3f + k * 4f
            val c = GOLD.alpha(0.5f + k * 0.5f)
            p.path(Shape().moveTo(x - r, y).lineTo(x + r, y), stroke = c, width = 2.5f)
            p.path(Shape().moveTo(x, y - r).lineTo(x, y + r), stroke = c, width = 2.5f)
        }
    }
}
