package hk.mm7lab.watchcat.core

enum class Kind { CAT, DOG, DRAGON }

enum class Ears { CAT, SMALL, BIG, FOLD, POINTY, BAT, FLOPPY, FINS }

enum class Tail { CAT, FLUFFY, THIN, OTTER, PLUME, CURL, STUB, DRAGON }

/**
 * What a pet looks like, front on. Colours follow the desktop app's breeds (pet/breeds.js), so the
 * watch pet matches the one on the computer.
 */
data class Look(
    val id: String,
    val label: String,
    val kind: Kind,
    val fur: Int,
    val belly: Int,
    val inner: Int,
    val eye: Int,
    val line: Int,
    val nose: Int,
    val stripe: Int? = null,   // tabby stripes
    val point: Int? = null,    // colourpoint: ears, face and tail (Siamese, Ragdoll)
    val mask: Int? = null,     // a dog's dark muzzle
    val saddle: Int? = null,   // a dark back (German Shepherd)
    val paw: Int? = null,
    val ears: Ears = if (kind == Kind.CAT) Ears.CAT else Ears.FLOPPY,
    val earScale: Float = 1f,
    val tail: Tail = if (kind == Kind.CAT) Tail.CAT else Tail.OTTER,
    val headWide: Float = 1f,  // rounder, wider face
    val flat: Float = 0f,      // flatter face (Persian)
    val fluff: Float = 0f,     // long fur: a ruff and fuller tail
    val snout: Float = if (kind == Kind.DOG) 1f else 0f,
    val pointLegs: Boolean = false,
)

object Looks {
    val CATS = listOf(
        Look("orange", "橙色虎斑貓", Kind.CAT, rgb(0xF3A35C), rgb(0xFFF4E4), rgb(0xFFAEAD), rgb(0x3A2A20), rgb(0x3D2A1F), rgb(0xFF8FA3), stripe = rgb(0xD8772F)),
        Look("grey", "灰色虎斑貓", Kind.CAT, rgb(0xAAB4BF), rgb(0xF3F5F7), rgb(0xF7B3BD), rgb(0x2B2F36), rgb(0x2F343B), rgb(0xFF8FA3), stripe = rgb(0x7A8592)),
        Look("black", "黑貓", Kind.CAT, rgb(0x3A3942), rgb(0x4A4952), rgb(0xD88A98), rgb(0xF2C94C), rgb(0x0F0E12), rgb(0xD88A98)),
        Look("white", "白貓", Kind.CAT, rgb(0xFBF8F3), rgb(0xFFFFFF), rgb(0xFFC0C6), rgb(0x5AA0D8), rgb(0x5A4B43), rgb(0xFF9FB0)),
        Look("tuxedo", "黑白貓", Kind.CAT, rgb(0x34333B), rgb(0xFBF8F3), rgb(0xD88A98), rgb(0x9FD36A), rgb(0x0F0E12), rgb(0xD88A98), paw = rgb(0xFBF8F3)),
        Look("persian", "波斯貓", Kind.CAT, rgb(0xFAF4EA), rgb(0xFFFFFF), rgb(0xFFC9CF), rgb(0xD9822B), rgb(0x6B5A4C), rgb(0xFFA3B4),
            ears = Ears.SMALL, tail = Tail.FLUFFY, headWide = 1.1f, flat = 1f, fluff = 1f),
        Look("british", "英國短毛貓", Kind.CAT, rgb(0x8D98A8), rgb(0x9EA8B6), rgb(0xC9A2AD), rgb(0xE59A2E), rgb(0x2E343D), rgb(0x6F7886),
            ears = Ears.SMALL, tail = Tail.FLUFFY, headWide = 1.12f, flat = 0.5f),
        Look("american", "美國短毛貓", Kind.CAT, rgb(0xC9CCD1), rgb(0xF1F2F4), rgb(0xF2B5BF), rgb(0x7FB54A), rgb(0x2C3036), rgb(0xFF8FA3), stripe = rgb(0x4D525A)),
        Look("ragdoll", "布偶貓", Kind.CAT, rgb(0xF6EEE0), rgb(0xFFFFFF), rgb(0xD9A7A6), rgb(0x4F9BE6), rgb(0x5B4A3E), rgb(0x6E584A),
            point = rgb(0x6E584A), paw = rgb(0xFFFFFF), tail = Tail.FLUFFY, fluff = 0.7f),
        Look("siamese", "暹羅貓", Kind.CAT, rgb(0xF1E5CF), rgb(0xF8F0E2), rgb(0x7A5546), rgb(0x4AA3F0), rgb(0x2D211A), rgb(0x3F2D23),
            point = rgb(0x3F2D23), pointLegs = true, ears = Ears.BIG, tail = Tail.THIN, headWide = 0.95f),
        Look("fold", "蘇格蘭摺耳貓", Kind.CAT, rgb(0xF0D6AA), rgb(0xFFF6E8), rgb(0xF3B4A8), rgb(0xD98A26), rgb(0x5A4330), rgb(0xFF9FA8),
            stripe = rgb(0xD9A663), ears = Ears.FOLD, headWide = 1.08f, flat = 0.4f),
    )
    val DOGS = listOf(
        Look("golden", "黃金獵犬", Kind.DOG, rgb(0xDFA24C), rgb(0xF0C27E), rgb(0xC98A3A), rgb(0x3E2614), rgb(0x5A3A18), rgb(0x2E211B),
            tail = Tail.PLUME, fluff = 0.6f),
        Look("labrador", "拉布拉多", Kind.DOG, rgb(0xECC98C), rgb(0xF4DCAE), rgb(0xD9AD6A), rgb(0x4A2E18), rgb(0x5A4126), rgb(0x3A2A22)),
        Look("frenchie", "法國鬥牛犬", Kind.DOG, rgb(0xE2B886), rgb(0xF1D6B0), rgb(0xD99A8F), rgb(0x2B1A12), rgb(0x3E2C20), rgb(0x241A16),
            mask = rgb(0x3A2C26), ears = Ears.BAT, tail = Tail.STUB, headWide = 1.1f, snout = 0.5f),
        Look("shepherd", "德國牧羊犬", Kind.DOG, rgb(0xC98A45), rgb(0xDCAB6E), rgb(0x3A302A), rgb(0x4A2C14), rgb(0x2B2018), rgb(0x1F1A17),
            mask = rgb(0x2B2420), saddle = rgb(0x2B2420), ears = Ears.POINTY, earScale = 1.15f, tail = Tail.PLUME),
        Look("dachshund", "臘腸犬", Kind.DOG, rgb(0xA1532A), rgb(0xB8693A), rgb(0x7D3C1C), rgb(0x2E1A10), rgb(0x40200F), rgb(0x241712),
            earScale = 1.2f, tail = Tail.THIN),
        Look("pomeranian", "博美犬", Kind.DOG, rgb(0xF2A443), rgb(0xFFD59A), rgb(0xE58A5A), rgb(0x2B1A10), rgb(0x6A3F14), rgb(0x241A16),
            ears = Ears.POINTY, earScale = 0.8f, tail = Tail.CURL, fluff = 1f, snout = 0.6f, headWide = 1.05f),
        Look("chihuahua", "吉娃娃", Kind.DOG, rgb(0xE8BB84), rgb(0xF6DCB6), rgb(0xF2A59A), rgb(0x2A1A10), rgb(0x5A3C22), rgb(0x3A2A24),
            ears = Ears.BIG, earScale = 0.95f, tail = Tail.THIN, snout = 0.55f),
    )
    /** A little black dragon of our own: big green eyes, fins on its head, folded wings and a finned tail. */
    val DRAGONS = listOf(
        Look("nightdragon", "黑龍仔", Kind.DRAGON, rgb(0x353B4A), rgb(0x404757), rgb(0x58627C), rgb(0x9FD94A), rgb(0x0C0E14), rgb(0x0C0E14),
            ears = Ears.FINS, tail = Tail.DRAGON, headWide = 1.08f, snout = 0f, paw = rgb(0x464D5F)),
    )
    val ALL = CATS + DOGS + DRAGONS

    fun byId(id: String): Look = ALL.firstOrNull { it.id == id } ?: CATS[0]
}
