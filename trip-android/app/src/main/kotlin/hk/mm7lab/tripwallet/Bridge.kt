package hk.mm7lab.tripwallet

import android.Manifest
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * What the page can ask the app, as window.TripBridge. Every call checks the page is our own
 * bundled one, and nothing here sends data off the phone.
 */
class Bridge(private val act: MainActivity) {
    private val ctx get() = act.applicationContext

    private fun trusted() = act.pageOrigin == "https://${MainActivity.HOST}"

    private fun ui(block: () -> Unit) = act.runOnUiThread { runCatching(block) }

    @JavascriptInterface
    fun status(): String {
        if (!trusted()) return "{}"
        val listener = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
        val battery = ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName)
        val notify = ctx.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
        return JSONObject()
            .put("listener", listener)
            .put("battery", battery)
            .put("notify", notify)
            .put("sdk", Build.VERSION.SDK_INT)
            .put("maker", Build.MANUFACTURER.orEmpty())
            .toString()
    }

    @JavascriptInterface
    fun openListenerSettings() {
        if (!trusted()) return
        ui {
            val component = ComponentName(ctx, PaymentListener::class.java).flattenToString()
            val detail = Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component)
            val ok = Build.VERSION.SDK_INT >= 30 && runCatching { act.startActivity(detail) }.isSuccess
            if (!ok) act.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    @android.annotation.SuppressLint("BatteryLife")
    @JavascriptInterface
    fun requestBattery() {
        if (!trusted()) return
        ui {
            val ask = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))
            if (runCatching { act.startActivity(ask) }.isFailure) {
                act.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
        }
    }

    @JavascriptInterface
    fun requestNotify() {
        if (!trusted()) return
        ui {
            if (Build.VERSION.SDK_INT >= 33 && !NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
                act.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), MainActivity.REQ_NOTIFY)
            } else {
                act.startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName),
                )
            }
        }
    }

    /** App info page: where Android puts "Allow restricted settings" and, on Xiaomi, autostart. */
    @JavascriptInterface
    fun openAppInfo() {
        if (!trusted()) return
        ui {
            act.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")))
        }
    }

    @JavascriptInterface
    fun pending(): String = if (trusted()) Store.pending(ctx).toString() else "[]"

    @JavascriptInterface
    fun confirmedList(): String = if (trusted()) Store.confirmed(ctx).toString() else "[]"

    @JavascriptInterface
    fun ackConfirmed(idsJson: String) {
        if (!trusted()) return
        val ids = runCatching { JSONArray(idsJson) }.getOrDefault(JSONArray())
        Store.ackConfirmed(ctx, (0 until ids.length()).map { ids.optString(it) }.toSet())
    }

    @JavascriptInterface
    fun confirm(id: String) {
        if (!trusted()) return
        if (Store.confirm(ctx, id)) Notifier.cancel(ctx, id)
    }

    @JavascriptInterface
    fun skip(id: String) {
        if (!trusted()) return
        if (Store.skip(ctx, id)) Notifier.cancel(ctx, id)
    }

    @JavascriptInterface
    fun apps(): String = if (trusted()) Store.apps(ctx).toString() else "[]"

    @JavascriptInterface
    fun setWatched(pkg: String, on: Boolean) {
        if (trusted()) Store.setWatched(ctx, pkg, on)
    }

    /** Hands an export (CSV or JSON backup) to the share sheet: save to Files or Drive, or send it. */
    @JavascriptInterface
    fun share(name: String, mime: String, content: String) {
        if (!trusted()) return
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifEmpty { "export.txt" }
        val dir = File(ctx.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, safe)
        file.writeText(content, Charsets.UTF_8)
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType(if (mime.startsWith("text/csv")) "text/csv" else mime.substringBefore(';'))
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_SUBJECT, safe)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        ui { act.startActivity(Intent.createChooser(send, safe)) }
    }
}
