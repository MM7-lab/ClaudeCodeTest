package hk.mm7.ledger;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.provider.Telephony;
import android.view.View;
import android.util.Log;
import android.view.WindowInsetsController;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * Hosts the ledger web app (bundled in assets/www) in a WebView and exposes the
 * auto-recording features to it through window.AndroidBridge.
 */
public class MainActivity extends Activity {
    static final String EXTRA_OPEN = "open";
    // A fixed https origin for the bundled files, so localStorage behaves like on the web.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/www/index.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_NOTIFY = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private volatile String launchAction = "";
    private final Runnable onStoreChange = () -> runOnUiThread(() -> js("window.__autoSync&&window.__autoSync()"));

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannel(this);
        readLaunch(getIntent());

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serveAsset(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOST.equals(req.getUrl().getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // Only the page's own "[ledger] …" status lines reach logcat (used by the CI emulator check).
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.message() != null && m.message().startsWith("[ledger]")) Log.i("LedgerWeb", m.message());
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl(HOME);
    }

    /** Serves https://appassets.androidplatform.net/www/... from the APK's assets; anything else is refused. */
    private WebResourceResponse serveAsset(Uri url) {
        if (!HOST.equals(url.getHost())) return new WebResourceResponse("text/plain", "utf-8", null);
        String path = url.getPath();
        if (path == null || !path.startsWith("/www/") || path.contains("..")) return null;
        try {
            InputStream in = getAssets().open(path.substring(1));
            return new WebResourceResponse(mime(path), "utf-8", in);
        } catch (Exception e) {
            return null;
        }
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript(code, null);
    }

    private void readLaunch(Intent i) {
        if (i != null && "inbox".equals(i.getStringExtra(EXTRA_OPEN))) launchAction = "inbox";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readLaunch(intent);
        js("window.__autoOpen&&window.__autoOpen()");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Store.get(this).addListener(onStoreChange);
        js("window.__autoSync&&window.__autoSync()");
    }

    @Override
    protected void onPause() {
        Store.get(this).removeListener(onStoreChange);
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        js("window.__autoSync&&window.__autoSync()");
    }

    private boolean listenerEnabled() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        return nm != null && nm.isNotificationListenerAccessGranted(new ComponentName(this, PaymentListener.class));
    }

    private boolean canNotify() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        android.app.NotificationChannel ch = nm.getNotificationChannel(Notifier.CHANNEL);
        return ch == null || ch.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private boolean ignoringBattery() {
        PowerManager pm = getSystemService(PowerManager.class);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void startSafely(Intent... choices) {
        runOnUiThread(() -> {
            for (Intent i : choices) {
                try {
                    startActivity(i);
                    return;
                } catch (Exception ignored) {
                    // try the next screen
                }
            }
        });
    }

    /** Called from the web page. Runs on a WebView thread, so UI work hops to the main thread. */
    final class Bridge {
        @JavascriptInterface
        public String getPending() {
            return Store.get(MainActivity.this).pendingJson();
        }

        @JavascriptInterface
        public void remove(String idsJson) {
            Set<String> ids = new HashSet<>();
            try {
                JSONArray a = new JSONArray(idsJson);
                for (int i = 0; i < a.length(); i++) ids.add(a.optString(i));
            } catch (JSONException e) {
                return;
            }
            Store.get(MainActivity.this).remove(ids);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) for (String id : ids) nm.cancel(Notifier.notifId(id));
        }

        @JavascriptInterface
        public String takeUndo() {
            return Store.get(MainActivity.this).takeUndo();
        }

        @JavascriptInterface
        public String getSources() {
            return Store.get(MainActivity.this).sourcesJson();
        }

        @JavascriptInterface
        public void setConfig(String json) {
            Store.get(MainActivity.this).setConfig(json);
        }

        @JavascriptInterface
        public String status() {
            try {
                return new JSONObject()
                        .put("listener", listenerEnabled())
                        .put("battery", ignoringBattery())
                        .put("notify", canNotify())
                        .put("sms", String.valueOf(Telephony.Sms.getDefaultSmsPackage(MainActivity.this)))
                        .put("brand", Build.MANUFACTURER)
                        .toString();
            } catch (JSONException e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void openListenerSettings() {
            Intent detail = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                    .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                            new ComponentName(MainActivity.this, PaymentListener.class).flattenToString());
            startSafely(detail, new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        }

        @JavascriptInterface
        @SuppressWarnings("BatteryLife")
        public void requestBattery() {
            startSafely(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())),
                    new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }

        @JavascriptInterface
        public void openAppSettings() {
            startSafely(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        }

        @JavascriptInterface
        public void requestNotify() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && shouldShowOrFirstAsk()) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
                } else {
                    startSafely(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                }
            });
        }

        /** Posts a made-up HK$1 payment so the user can try the confirm notification. */
        @JavascriptInterface
        public void testCapture() {
            try {
                long ts = System.currentTimeMillis();
                JSONObject p = new JSONObject()
                        .put("id", Store.newId())
                        .put("pkg", getPackageName())
                        .put("app", "測試")
                        .put("amt", 1)
                        .put("type", "exp")
                        .put("note", "測試付款（可以略過）")
                        .put("date", new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date(ts)))
                        .put("ts", ts)
                        .put("status", Store.get(MainActivity.this).autoMode() ? "ok" : "new");
                if (Store.get(MainActivity.this).addPending(p)) {
                    Notifier.captured(MainActivity.this, p, "ok".equals(p.optString("status")));
                }
            } catch (JSONException ignored) {
                // cannot happen with literal values
            }
        }

        @JavascriptInterface
        public String takeLaunchAction() {
            String a = launchAction;
            launchAction = "";
            return a;
        }

        /** Saves an export into the phone's Downloads folder. Returns "" on success, or an error message. */
        @JavascriptInterface
        public String saveFile(String name, String mime, String text) {
            String safe = name == null ? "ledger.txt" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime == null ? "text/plain" : mime.split(";")[0]);
            ContentResolver cr = getContentResolver();
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return "儲存唔到檔案";
            try (OutputStream out = cr.openOutputStream(uri)) {
                if (out == null) return "儲存唔到檔案";
                out.write(text.getBytes(StandardCharsets.UTF_8));
                return "";
            } catch (Exception e) {
                cr.delete(uri, null, null);
                return "儲存唔到檔案：" + e.getMessage();
            }
        }

        /** Matches the purple app bar; white status-bar icons on top of it. */
        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void setStatusBar(String color) {
            runOnUiThread(() -> {
                try {
                    getWindow().setStatusBarColor(Color.parseColor(color.trim()));
                } catch (Exception ignored) {
                    return;
                }
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController c = getWindow().getInsetsController();
                    if (c != null) c.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                } else {
                    View d = getWindow().getDecorView();
                    d.setSystemUiVisibility(d.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                }
            });
        }
    }

    private boolean askedNotify;

    /** Android only shows the permission dialog a couple of times; after that, send the user to settings. */
    private boolean shouldShowOrFirstAsk() {
        if (!askedNotify) {
            askedNotify = true;
            return true;
        }
        return shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS);
    }
}
