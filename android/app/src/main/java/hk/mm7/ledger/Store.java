package hk.mm7.ledger;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Captured payments waiting to reach the ledger, plus the auto-recording settings.
 * Everything sits in this app's private SharedPreferences; nothing leaves the phone.
 *
 * Pending item: {id, pkg, app, amt, type, note, date, ts, status}
 *   status "new" = waiting for the user to confirm, "ok" = confirmed, the web ledger imports and removes it.
 */
final class Store {
    private static final String PREFS = "auto";
    private static final int MAX_PENDING = 300;
    private static Store instance;

    private final SharedPreferences prefs;
    private final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();

    private Store(Context c) {
        prefs = c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized Store get(Context c) {
        if (instance == null) instance = new Store(c);
        return instance;
    }

    void addListener(Runnable r) { listeners.addIfAbsent(r); }
    void removeListener(Runnable r) { listeners.remove(r); }
    private void changed() { for (Runnable r : listeners) r.run(); }

    static String newId() {
        return "p" + Long.toString(System.currentTimeMillis(), 36) + Integer.toString((int) (Math.random() * 46656), 36);
    }

    private JSONArray readArray(String key) {
        try {
            return new JSONArray(prefs.getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private JSONObject readObject(String key) {
        try {
            return new JSONObject(prefs.getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    // ---- pending payments ----

    /** Adds a captured payment unless it repeats one seen in the last 90 seconds (apps often re-post the same notification). */
    synchronized boolean addPending(JSONObject p) {
        JSONArray list = readArray("pending");
        long ts = p.optLong("ts");
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o == null) continue;
            if (o.optString("pkg").equals(p.optString("pkg"))
                    && o.optDouble("amt") == p.optDouble("amt")
                    && o.optString("type").equals(p.optString("type"))
                    && o.optString("note").equals(p.optString("note"))
                    && Math.abs(o.optLong("ts") - ts) < 90_000) {
                return false;
            }
        }
        list.put(p);
        while (list.length() > MAX_PENDING) list.remove(0);
        prefs.edit().putString("pending", list.toString()).apply();
        changed();
        return true;
    }

    synchronized String pendingJson() {
        return readArray("pending").toString();
    }

    synchronized JSONObject find(String id) {
        JSONArray list = readArray("pending");
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o != null && id.equals(o.optString("id"))) return o;
        }
        return null;
    }

    synchronized void setStatus(String id, String status) {
        JSONArray list = readArray("pending");
        boolean hit = false;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o != null && id.equals(o.optString("id"))) {
                try {
                    o.put("status", status);
                    hit = true;
                } catch (JSONException ignored) {
                    // a String value always fits
                }
            }
        }
        if (!hit) return;
        prefs.edit().putString("pending", list.toString()).apply();
        changed();
    }

    synchronized void remove(Set<String> ids) {
        if (ids.isEmpty()) return;
        JSONArray list = readArray("pending");
        JSONArray keep = new JSONArray();
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o != null && !ids.contains(o.optString("id"))) keep.put(o);
        }
        prefs.edit().putString("pending", keep.toString()).apply();
        changed();
    }

    // ---- undo of an auto-recorded payment the ledger may already have imported ----

    synchronized void undo(String id) {
        if (find(id) != null) {
            Set<String> one = new HashSet<>();
            one.add(id);
            remove(one);
            return;
        }
        JSONArray u = readArray("undo");
        u.put(id);
        prefs.edit().putString("undo", u.toString()).apply();
        changed();
    }

    synchronized String takeUndo() {
        String s = readArray("undo").toString();
        prefs.edit().remove("undo").apply();
        return s;
    }

    // ---- settings pushed from the ledger: {mode: "confirm"|"auto", sources: {pkg: {on: bool, label}}} ----

    synchronized void setConfig(String json) {
        try {
            JSONObject c = new JSONObject(json);
            prefs.edit().putString("config", c.toString()).apply();
        } catch (JSONException ignored) {
            // keep the previous settings
        }
    }

    synchronized boolean autoMode() {
        return "auto".equals(readObject("config").optString("mode"));
    }

    /** Apps are on until the user switches them off; the parser already ignores chat apps and SMS. */
    synchronized boolean sourceEnabled(String pkg) {
        JSONObject src = readObject("config").optJSONObject("sources");
        JSONObject s = src == null ? null : src.optJSONObject(pkg);
        return s == null || s.optBoolean("on", true);
    }

    // ---- 偵錯記錄: the last 20 money-looking notifications and what the parser made of them.
    // Off by default, switches itself off after 3 days, and stays on the phone. ----

    private static final long DEBUG_MS = 3L * 24 * 60 * 60 * 1000;

    synchronized boolean debugOn() {
        long since = prefs.getLong("debugSince", 0);
        if (since == 0) return false;
        if (System.currentTimeMillis() - since > DEBUG_MS) {
            prefs.edit().putLong("debugSince", 0).apply();
            return false;
        }
        return true;
    }

    synchronized void setDebug(boolean on) {
        prefs.edit().putLong("debugSince", on ? System.currentTimeMillis() : 0).apply();
        if (!on) prefs.edit().remove("debug").apply();
    }

    synchronized void addDebug(String pkg, String label, String title, String text, String verdict, long ts) {
        JSONArray list = readArray("debug");
        try {
            String body = (title + "\n" + text).trim();
            list.put(new JSONObject().put("pkg", pkg).put("app", label).put("text", body.length() > 300 ? body.substring(0, 300) : body)
                    .put("verdict", verdict).put("ts", ts));
        } catch (JSONException ignored) {
            return;
        }
        while (list.length() > 20) list.remove(0);
        prefs.edit().putString("debug", list.toString()).apply();
    }

    synchronized String debugJson() {
        try {
            return new JSONObject().put("on", debugOn()).put("since", prefs.getLong("debugSince", 0)).put("items", readArray("debug")).toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    // ---- 365-day challenge settings pushed from the ledger: {on, dir, start, unit, days, remindDay} ----

    synchronized void setChallenge(String json) {
        try {
            prefs.edit().putString("challenge", new JSONObject(json).toString()).apply();
        } catch (JSONException ignored) {
            // keep the previous settings
        }
    }

    synchronized Challenge challenge() {
        JSONObject o = readObject("challenge");
        try {
            return new Challenge(o.optBoolean("on"), !"up".equals(o.optString("dir")),
                    java.time.LocalDate.parse(o.optString("start", "2026-01-01")),
                    o.optDouble("unit", 2), o.optInt("days", 365), o.optInt("remindDay", 1));
        } catch (RuntimeException e) {
            return null;
        }
    }

    // ---- apps that have sent a payment-looking notification (no message text is kept) ----

    synchronized void noteSource(String pkg, String label, long ts) {
        JSONObject all = readObject("sources");
        JSONObject s = all.optJSONObject(pkg);
        try {
            if (s == null) s = new JSONObject();
            s.put("label", label);
            s.put("count", s.optInt("count") + 1);
            s.put("last", ts);
            all.put(pkg, s);
            // Keep the 50 most recent sources.
            if (all.length() > 50) {
                String oldest = null;
                long min = Long.MAX_VALUE;
                for (Iterator<String> it = all.keys(); it.hasNext(); ) {
                    String k = it.next();
                    long l = all.optJSONObject(k) == null ? 0 : all.optJSONObject(k).optLong("last");
                    if (l < min) { min = l; oldest = k; }
                }
                if (oldest != null) all.remove(oldest);
            }
        } catch (JSONException ignored) {
            return;
        }
        prefs.edit().putString("sources", all.toString()).apply();
    }

    synchronized String sourcesJson() {
        JSONObject all = readObject("sources");
        JSONArray out = new JSONArray();
        for (Iterator<String> it = all.keys(); it.hasNext(); ) {
            String k = it.next();
            JSONObject s = all.optJSONObject(k);
            if (s == null) continue;
            try {
                out.put(new JSONObject().put("pkg", k).put("label", s.optString("label", k))
                        .put("count", s.optInt("count")).put("last", s.optLong("last")));
            } catch (JSONException ignored) {
                // skip a malformed entry
            }
        }
        return out.toString();
    }
}
