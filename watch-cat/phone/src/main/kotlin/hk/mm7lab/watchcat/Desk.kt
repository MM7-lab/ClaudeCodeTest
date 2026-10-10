package hk.mm7lab.watchcat

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import hk.mm7lab.watchcat.core.Kind
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The 3D scene on the home screen is the desktop app's pet world. This keeps the phone's choices
 * for it (who else is out, the cat tree, the birds...) and the background, and turns them into the
 * desktop app's settings.
 */
object Desk {
    data class Scene(
        val size: Float = 1.2f,
        val sound: Boolean = false,
        val chatty: Boolean = true,
        val tree: Boolean = true,
        val birds: Int = 2,
        val pig: Boolean = true,
        val friends: List<String> = listOf("british"),
        val dogHouse: Boolean = false,
        val office: Boolean = false,
        val toys: List<String> = emptyList(),
        val bg: String = "room",
        val photoAt: Long = 0L,
    )

    /** Friends who can come out (the desktop app's breeds). */
    val FRIENDS = listOf(
        "persian", "british", "american", "ragdoll", "siamese", "fold",
        "golden", "labrador", "frenchie", "shepherd", "dachshund", "pomeranian", "chihuahua", "nightdragon",
    )
    val TOYS = listOf("baby-bear" to "熊啤啤", "plush-octopus" to "八爪魚", "hello-kitty" to "Hello Kitty", "moomin" to "姆明", "turbo-granny" to "高速婆婆")
    private val COATS = listOf("orange", "grey", "black", "white", "tuxedo")

    /** Backgrounds: a few scenes drawn in CSS, the floor along the bottom where the pets walk. */
    val BACKGROUNDS = listOf(
        "room" to "🛋️ 客廳",
        "garden" to "🌳 草地",
        "night" to "🌙 夜空",
        "beach" to "🏖️ 海邊",
        "office" to "💼 辦公室",
        "sakura" to "🌸 櫻花",
        "plain" to "⬛ 純色",
        "photo" to "🖼️ 自己張相",
    )
    private const val STARS = "radial-gradient(circle at 12% 18%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 34% 9%, #fff 0 1px, transparent 2px), " +
        "radial-gradient(circle at 52% 27%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 66% 12%, #fff 0 1px, transparent 2px), " +
        "radial-gradient(circle at 90% 34%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 22% 42%, #fff 0 1px, transparent 2px), " +
        "radial-gradient(circle at 46% 52%, #fff 0 1px, transparent 2px), radial-gradient(circle at 74% 48%, #fff 0 1.5px, transparent 2.5px), "
    private val CSS = mapOf(
        // a warm wall with a window of light, a wooden floor
        "room" to "radial-gradient(ellipse 40% 26% at 72% 30%, #fffaf0 0 60%, rgba(255,250,240,0) 100%), " +
            "linear-gradient(#f4e2cc 0%, #efd7bb 80%, #b9875a 80%, #c89a6c 84%, #a8774c 100%)",
        // blue sky, the sun, grass
        "garden" to "radial-gradient(circle at 62% 13%, #fff7c2 0 34px, rgba(255,247,194,.5) 40px, rgba(255,247,194,0) 70px), " +
            "radial-gradient(ellipse 30% 4% at 25% 22%, #fff 0 60%, rgba(255,255,255,0) 100%), radial-gradient(ellipse 22% 3% at 60% 30%, #fff 0 60%, rgba(255,255,255,0) 100%), " +
            "linear-gradient(#78c6ef 0%, #c9ecfb 78%, #9bd67c 80%, #6fb556 100%)",
        // stars and the moon
        "night" to "radial-gradient(circle at 60% 15%, #fff8d6 0 26px, rgba(255,248,214,.25) 32px, rgba(255,248,214,0) 60px), " + STARS +
            "linear-gradient(#0b1030 0%, #1e2a5a 80%, #2c3a4a 82%, #1d2630 100%)",
        // sky, the sea, sand
        "beach" to "radial-gradient(circle at 42% 13%, #fff3b0 0 30px, rgba(255,243,176,0) 60px), " +
            "linear-gradient(#7cc8f0 0%, #bfe7fb 60%, #3fa7d6 60%, #5bc0e6 79%, #f3dfae 79%, #e8cc90 100%)",
        // a pale wall, a big window, a grey floor
        "office" to "linear-gradient(90deg, transparent 54%, rgba(170,210,250,.6) 54% 90%, transparent 90%) 0 8% / 100% 40% no-repeat, " +
            "linear-gradient(#e6ebf0 0%, #dde3ea 80%, #8f9aa6 80%, #7d8894 100%)",
        // pink blossom
        "sakura" to "radial-gradient(circle at 10% 14%, #ffc6d6 0 70px, rgba(255,198,214,0) 110px), radial-gradient(circle at 88% 22%, #ffb8cc 0 80px, rgba(255,184,204,0) 120px), " +
            "linear-gradient(#ffeef3 0%, #ffe1ea 80%, #d9b38c 82%, #c79f78 100%)",
        "plain" to "#1b1d25",
    )

    val changes = MutableStateFlow(0L)
    private var prefs: SharedPreferences? = null
    private fun p(ctx: Context) = prefs ?: ctx.applicationContext.getSharedPreferences("desk", Context.MODE_PRIVATE).also { prefs = it }

    fun scene(ctx: Context): Scene {
        val p = p(ctx)
        val d = Scene()
        fun list(k: String, def: List<String>) = p.getString(k, null)?.split(',')?.filter { it.isNotBlank() } ?: def
        return Scene(
            size = p.getFloat("size", d.size).coerceIn(0.4f, 1.8f),
            sound = p.getBoolean("sound", d.sound),
            chatty = p.getBoolean("chatty", d.chatty),
            tree = p.getBoolean("tree", d.tree),
            birds = p.getInt("birds", d.birds).coerceIn(0, 3),
            pig = p.getBoolean("pig", d.pig),
            friends = list("friends", d.friends).filter { it in FRIENDS },
            dogHouse = p.getBoolean("dogHouse", d.dogHouse),
            office = p.getBoolean("office", d.office),
            toys = list("toys", d.toys).filter { id -> TOYS.any { it.first == id } },
            bg = p.getString("bg", d.bg)?.takeIf { id -> BACKGROUNDS.any { it.first == id } } ?: d.bg,
            photoAt = p.getLong("photoAt", 0L),
        )
    }

    fun save(ctx: Context, s: Scene) {
        p(ctx).edit()
            .putFloat("size", s.size).putBoolean("sound", s.sound).putBoolean("chatty", s.chatty)
            .putBoolean("tree", s.tree).putInt("birds", s.birds).putBoolean("pig", s.pig)
            .putString("friends", s.friends.joinToString(",")).putBoolean("dogHouse", s.dogHouse)
            .putBoolean("office", s.office).putString("toys", s.toys.joinToString(","))
            .putString("bg", s.bg).putLong("photoAt", s.photoAt)
            .apply()
        changes.value = changes.value + 1
    }

    fun dir(ctx: Context) = File(ctx.filesDir, "scene").apply { mkdirs() }
    private fun photo(ctx: Context) = File(dir(ctx), "bg.jpg")

    fun backgroundCss(ctx: Context): String {
        val s = scene(ctx)
        if (s.bg == "photo" && photo(ctx).exists()) return "#1b1d25 url('/files/bg.jpg?v=${s.photoAt}') center / cover no-repeat"
        return CSS[s.bg] ?: CSS.getValue("room")
    }

    /** Use a photo from the gallery as the background (made smaller, and turned the right way up). */
    fun setPhoto(ctx: Context, uri: Uri): Boolean = runCatching {
        val src = ImageDecoder.createSource(ctx.contentResolver, uri)
        val bmp = ImageDecoder.decodeBitmap(src) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val big = maxOf(info.size.width, info.size.height)
            if (big > 2048) {
                val k = 2048f / big
                decoder.setTargetSize((info.size.width * k).toInt(), (info.size.height * k).toInt())
            }
        }
        photo(ctx).outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }
        save(ctx, scene(ctx).copy(bg = "photo", photoAt = System.currentTimeMillis()))
    }.isSuccess

    /** The desktop app's settings for the scene, from the phone's settings and scene choices. */
    fun settingsJson(ctx: Context): JSONObject {
        val s = Store.settings(ctx)
        val sc = scene(ctx)
        val look = s.look
        val o = JSONObject()
        o.put("name", s.name)
        when (look.kind) {
            Kind.CAT -> {
                o.put("mainPet", "cat")
                o.put("breed", if (look.id in COATS) "classic" else look.id)
                o.put("coat", if (look.id in COATS) look.id else "orange")
            }
            Kind.DOG -> { o.put("mainPet", "dog"); o.put("dogBreed", look.id) }
            Kind.DRAGON -> o.put("mainPet", "dragon")
        }
        o.put("size", sc.size.toDouble())
        o.put("every", s.intervalMin)
        o.put("types", JSONObject().put("water", s.water).put("rest", s.rest).put("toilet", s.toilet))
        o.put("chatty", sc.chatty)
        o.put("sound", sc.sound)
        o.put("volume", 0.6)
        o.put("tree", if (sc.tree) "right" else "off")
        o.put("toys", JSONArray(sc.toys))
        o.put("toySize", 70)
        o.put("birdCount", sc.birds)
        o.put(
            "birds",
            JSONArray()
                .put(JSONObject().put("name", "檸檬").put("color", "yellow"))
                .put(JSONObject().put("name", "藍莓").put("color", "blue"))
                .put(JSONObject().put("name", "蜜桃").put("color", "pink")),
        )
        o.put("cage", if (sc.birds > 0) "both" else "off")
        o.put("pig", sc.pig)
        o.put("pigName", "布甸")
        o.put("pigBed", "left")
        o.put("friends", JSONArray(sc.friends))
        o.put("dogHouse", if (sc.dogHouse) "right" else "off")
        o.put("office", sc.office)
        o.put("workers", JSONArray().put("main").put("auto"))
        o.put("officeFurn", JSONArray(listOf("sofa", "cooler", "shelf", "board", "printer", "plant")))
        return o
    }
}
