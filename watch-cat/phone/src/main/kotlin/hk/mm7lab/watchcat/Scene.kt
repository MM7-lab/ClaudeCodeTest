package hk.mm7lab.watchcat

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import hk.mm7lab.watchcat.core.RType
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.io.InputStream

/**
 * The home screen's 3D world: the desktop app's pet page in a WebView. The app's reminders and
 * settings go in as the events the desktop app would send; answers and pats come back out.
 */
class Scene(private val ctx: Context, private val onSettings: () -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val scope = MainScope()
    @Volatile private var lastSettings = ""
    @Volatile private var lastBg = ""
    private var ready = false
    private var shownPending: RType? = null
    private var shownNags = 0

    @SuppressLint("SetJavaScriptEnabled")
    val web: WebView = WebView(ctx).also { WebView.setWebContentsDebuggingEnabled(true) }.apply {
        // fill the space it's given: with the default "as tall as the page", the page sees a 0-high
        // window (100vh = 0) and the scene is squashed to nothing
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setBackgroundColor(Color.parseColor("#1b1d25"))
        overScrollMode = View.OVER_SCROLL_NEVER
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        // serve the app's files to the page, saying exactly what each one is (scripts must be
        // "text/javascript" or the browser won't run them as modules)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/") { path -> serve(path) { ctx.assets.open(path) } }
            .addPathHandler("/files/") { path -> serve(path) { File(Desk.dir(ctx), path.substringBefore('?')).inputStream() } }
            .build()
        // the page's console in logcat, for finding problems
        webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.i(TAG, "${m.messageLevel()} ${m.sourceId()}:${m.lineNumber()} ${m.message()}")
                return true
            }
        }
        webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) { Log.i(TAG, "page loaded: $url") }
        }
        addJavascriptInterface(Bridge(), "AndroidCat")
        loadUrl("https://appassets.androidplatform.net/assets/desk/pet/index.html?debug")
    }

    private fun serve(path: String, open: () -> InputStream): WebResourceResponse? = try {
        val type = mime(path)
        WebResourceResponse(type, if (type.startsWith("text/") || type.endsWith("json")) "utf-8" else null, open())
    } catch (e: Exception) {
        Log.w(TAG, "missing: $path ($e)")
        null
    }

    private fun mime(path: String) = when (path.substringBefore('?').substringAfterLast('.', "").lowercase()) {
        "html", "htm" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "svg" -> "image/svg+xml"
        "wasm" -> "application/wasm"
        else -> "application/octet-stream"
    }

    private fun js(code: String) = web.evaluateJavascript(code, null)
    private fun emit(channel: String, data: String) = js("window.__catEmit && __catEmit(${JSONObject.quote(channel)}, $data)")

    /** Bring the scene up to date with the app: settings, background, the reminder. */
    fun sync() {
        if (!ready) return
        val settings = Desk.settingsJson(ctx).toString()
        if (settings != lastSettings) { lastSettings = settings; emit("settings", settings) }
        val bg = Desk.backgroundCss(ctx)
        if (bg != lastBg) { lastBg = bg; js("window.__setBackground && __setBackground(${JSONObject.quote(bg)})") }
        val t = Store.timer(ctx)
        val pending = t.pending
        if (pending != shownPending) {
            val line = Store.line(ctx).first
            if (pending != null) {
                emit("reminder", JSONObject().put("type", pending.id).put("emoji", pending.emoji).put("text", line).toString())
            } else {
                emit("reminder-end", JSONObject().put("done", Store.answered(ctx)).put("text", line).toString())
            }
            shownPending = pending
            shownNags = t.nags
        } else if (pending != null && t.nags > shownNags) {
            shownNags = t.nags
            emit("nag", "{}")
        }
    }

    fun group(action: String) = emit("group-action", JSONObject.quote(action))
    fun comeHere() = emit("come-here", "{}")

    companion object { private const val TAG = "PhoneCatScene" }

    fun pause() = web.onPause()
    fun resume() = web.onResume()

    /**
     * What the page can ask of the app (window.AndroidCat). Called off the main thread. It must be
     * a public class: the WebView reaches these methods by reflection.
     */
    inner class Bridge {
        @JavascriptInterface
        fun getState(): String {
            val s = runCatching { Desk.settingsJson(ctx) }.getOrElse { Log.e(TAG, "settings", it); JSONObject() }
            lastSettings = s.toString()
            Log.i(TAG, "getState: $lastSettings")
            return JSONObject().put("settings", s).toString()
        }

        @JavascriptInterface
        fun background(): String = runCatching { Desk.backgroundCss(ctx) }
            .getOrElse { Log.e(TAG, "background", it); "#1b1d25" }
            .also { lastBg = it; Log.i(TAG, "background: ${it.take(60)}") }

        @JavascriptInterface
        fun answer(done: Boolean) { main.post { scope.launch { Actions.answer(ctx, done) } } }

        @JavascriptInterface
        fun petted() { main.post { Actions.pet(ctx) } }

        @JavascriptInterface
        fun ready() {
            Log.i(TAG, "scene ready")
            main.post {
                ready = true
                shownPending = null
                sync()
            }
        }

        @JavascriptInterface
        fun openSettings() { main.post { onSettings() } }
    }
}
