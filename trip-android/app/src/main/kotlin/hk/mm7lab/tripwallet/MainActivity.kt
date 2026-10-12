package hk.mm7lab.tripwallet

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/** The tracker page (docs/japan-trip, bundled in the APK) in a WebView, plus the bridge to the notification listener. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    /** Origin of the page now showing; the bridge only answers our own bundled page. */
    @Volatile var pageOrigin: String = ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notifier.ensureChannel(this)
        handleDebugIntent(intent)

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                // Anything else (a link out) opens in the browser, never inside the app.
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                pageOrigin = Uri.parse(url ?: "").let { "${it.scheme}://${it.host}" }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.i("TripWeb", m.message())
                return true
            }

            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val pick = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                return runCatching { startActivityForResult(pick, REQ_FILE); true }.getOrElse {
                    fileCallback = null
                    false
                }
            }
        }
        web.addJavascriptInterface(Bridge(this), "TripBridge")
        web.loadUrl("https://$HOST/assets/web/index.html")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDebugIntent(intent)
        refreshPage()
    }

    override fun onResume() {
        super.onResume()
        Store.onChange = { refreshPage() }
        refreshPage()
    }

    override fun onPause() {
        Store.onChange = null
        super.onPause()
    }

    fun refreshPage() {
        if (::web.isInitialized) web.evaluateJavascript("window.tripNative && window.tripNative.refresh()", null)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshPage()
    }

    /** Debug builds only: lets the CI emulator check press 記帳 on everything pending. */
    private fun handleDebugIntent(i: Intent?) {
        if (BuildConfig.DEBUG && i?.getBooleanExtra("debugConfirmAll", false) == true) Store.confirmAll(this)
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val REQ_FILE = 41
        const val REQ_NOTIFY = 42
    }
}
