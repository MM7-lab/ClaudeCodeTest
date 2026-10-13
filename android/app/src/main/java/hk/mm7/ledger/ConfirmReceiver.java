package hk.mm7.ledger;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

import java.util.Collections;

/** Handles the 記低 / 略過 / 復原 buttons on the confirm notification. */
public class ConfirmReceiver extends BroadcastReceiver {
    static final String OK = "hk.mm7.ledger.OK";
    static final String SKIP = "hk.mm7.ledger.SKIP";
    static final String UNDO = "hk.mm7.ledger.UNDO";
    static final String EXTRA_ID = "id";

    @Override
    public void onReceive(Context c, Intent intent) {
        String id = intent.getStringExtra(EXTRA_ID);
        String what = intent.getAction();
        if (id == null || what == null) return;
        Store store = Store.get(c);
        if (OK.equals(what)) {
            store.setStatus(id, "ok");
            Toast.makeText(c, "已記低，下次打開記帳就會見到", Toast.LENGTH_SHORT).show();
        } else if (SKIP.equals(what)) {
            store.remove(Collections.singleton(id));
        } else if (UNDO.equals(what)) {
            store.undo(id);
            Toast.makeText(c, "已復原", Toast.LENGTH_SHORT).show();
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(Notifier.notifId(id));
    }
}
