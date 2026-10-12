package hk.mm7lab.tripwallet

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import hk.mm7lab.tripwallet.core.Payment
import hk.mm7lab.tripwallet.core.PaymentParser
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * What the notification listener found, kept on this phone only (app-private storage, no backup).
 *
 * - pending: payments waiting for the person to tap 記帳 or 略過
 * - confirmed: payments the person accepted, waiting for the page to add them to its ledger
 * - watch: which apps to read (true/false per package); apps without a choice use [PaymentParser.isLikelyPaymentApp]
 * - seen: names of apps that posted notifications lately, so the person can pick more apps to watch (no content)
 */
object Store {
    private const val PREFS = "trip"
    private const val MAX_SEEN = 60
    private val main = Handler(Looper.getMainLooper())

    /** Called on the main thread whenever pending or confirmed changes, so an open page can refresh. */
    @Volatile var onChange: (() -> Unit)? = null

    private fun prefs(c: Context): SharedPreferences = c.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun list(c: Context, key: String): JSONArray =
        runCatching { JSONArray(prefs(c).getString(key, "[]")) }.getOrDefault(JSONArray())

    private fun putList(c: Context, key: String, a: JSONArray) {
        prefs(c).edit().putString(key, a.toString()).apply()
    }

    private fun changed() = main.post { onChange?.invoke() }

    @Synchronized
    fun addPending(c: Context, p: Payment, appLabel: String, time: Long, sourceKey: String): JSONObject? {
        val pending = list(c, "pending")
        // A bank often updates the same notification; one notification, one amount, one entry.
        val sig = "$sourceKey|${p.amount}|${p.currency}"
        for (i in 0 until pending.length()) if (sigOf(pending.getJSONObject(i)) == sig) return null
        val handled = list(c, "handled")
        for (i in 0 until handled.length()) if (handled.optString(i) == sig) return null
        val item = JSONObject()
            .put("id", UUID.randomUUID().toString().replace("-", "").take(16))
            .put("amount", p.amount)
            .put("cur", p.currency)
            .put("pay", p.method)
            .put("app", appLabel)
            .put("text", p.text)
            .put("time", time)
            .put("src", sourceKey)
        pending.put(item)
        while (pending.length() > 50) pending.remove(0)
        putList(c, "pending", pending)
        changed()
        return item
    }

    @Synchronized
    fun pending(c: Context): JSONArray = list(c, "pending")

    @Synchronized
    fun confirmed(c: Context): JSONArray = list(c, "confirmed")

    /** Moves a pending payment to confirmed. Returns false if it was already handled. */
    @Synchronized
    fun confirm(c: Context, id: String): Boolean {
        val item = takePending(c, id) ?: return false
        val confirmed = list(c, "confirmed").put(item)
        putList(c, "confirmed", confirmed)
        changed()
        return true
    }

    @Synchronized
    fun confirmAll(c: Context) {
        val pending = list(c, "pending")
        val confirmed = list(c, "confirmed")
        for (i in 0 until pending.length()) {
            confirmed.put(pending.getJSONObject(i))
            remember(c, pending.getJSONObject(i))
        }
        putList(c, "confirmed", confirmed)
        putList(c, "pending", JSONArray())
        changed()
    }

    @Synchronized
    fun skip(c: Context, id: String): Boolean {
        val gone = takePending(c, id) != null
        if (gone) changed()
        return gone
    }

    /** The page saved these into its ledger, so drop them here. */
    @Synchronized
    fun ackConfirmed(c: Context, ids: Set<String>) {
        val keep = JSONArray()
        val confirmed = list(c, "confirmed")
        for (i in 0 until confirmed.length()) {
            val o = confirmed.getJSONObject(i)
            if (o.optString("id") !in ids) keep.put(o)
        }
        putList(c, "confirmed", keep)
    }

    private fun sigOf(o: JSONObject) = "${o.optString("src")}|${o.optDouble("amount")}|${o.optString("cur")}"

    /** Remember handled notifications for a while, so an update of the same one is not asked about again. */
    private fun remember(c: Context, o: JSONObject) {
        val handled = list(c, "handled").put(sigOf(o))
        while (handled.length() > 100) handled.remove(0)
        putList(c, "handled", handled)
    }

    private fun takePending(c: Context, id: String): JSONObject? {
        val pending = list(c, "pending")
        val keep = JSONArray()
        var found: JSONObject? = null
        for (i in 0 until pending.length()) {
            val o = pending.getJSONObject(i)
            if (found == null && o.optString("id") == id) found = o else keep.put(o)
        }
        if (found != null) {
            putList(c, "pending", keep)
            remember(c, found)
        }
        return found
    }

    // ---- which apps to read ----

    fun isWatched(c: Context, pkg: String, label: String): Boolean {
        val p = prefs(c)
        val key = "watch:$pkg"
        if (p.contains(key)) return p.getBoolean(key, false)
        // Debug builds also read notifications posted from adb, for the emulator check in CI.
        if (BuildConfig.DEBUG && pkg == "com.android.shell") return true
        return PaymentParser.isLikelyPaymentApp(label, pkg)
    }

    fun setWatched(c: Context, pkg: String, on: Boolean) {
        prefs(c).edit().putBoolean("watch:$pkg", on).apply()
    }

    @Synchronized
    fun noteSeen(c: Context, pkg: String, label: String) {
        val seen = runCatching { JSONObject(prefs(c).getString("seen", "{}")) }.getOrDefault(JSONObject())
        if (seen.optString(pkg) == label) return
        seen.put(pkg, label)
        while (seen.length() > MAX_SEEN) seen.remove(seen.keys().next())
        prefs(c).edit().putString("seen", seen.toString()).apply()
    }

    fun apps(c: Context): JSONArray {
        val seen = runCatching { JSONObject(prefs(c).getString("seen", "{}")) }.getOrDefault(JSONObject())
        val out = JSONArray()
        seen.keys().forEach { pkg ->
            val label = seen.optString(pkg)
            out.put(JSONObject().put("pkg", pkg).put("label", label).put("watched", isWatched(c, pkg, label)))
        }
        return out
    }
}
