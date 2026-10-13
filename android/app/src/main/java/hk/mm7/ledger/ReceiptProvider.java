package hk.mm7.ledger;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Gives the camera app a file in this app's cache to save a receipt photo into, so taking a
 * photo needs no storage permission and the picture never lands in the phone's gallery.
 * The web page copies it into its own storage straight away; old files are cleaned up on start.
 */
public class ReceiptProvider extends ContentProvider {
    static final String AUTHORITY = "hk.mm7.ledger.receipts";
    private static final long KEEP_MS = 24L * 60 * 60 * 1000;

    static File dir(Context c) {
        File d = new File(c.getCacheDir(), "capture");
        //noinspection ResultOfMethodCallIgnored
        d.mkdirs();
        return d;
    }

    static Uri newCaptureUri(Context c) {
        return Uri.parse("content://" + AUTHORITY + "/r" + System.currentTimeMillis() + ".jpg");
    }

    static void cleanup(Context c) {
        File[] files = dir(c).listFiles();
        if (files == null) return;
        long now = System.currentTimeMillis();
        for (File f : files) {
            if (now - f.lastModified() > KEEP_MS) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    private File file(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("r[0-9]+\\.jpg")) throw new FileNotFoundException(String.valueOf(uri));
        return new File(dir(getContext()), name);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.parseMode(mode));
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File f;
        try {
            f = file(uri);
        } catch (FileNotFoundException e) {
            return null;
        }
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
