package eu.senda.field;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Guarda en el móvil lo que la web genera (vídeos de la dashcam, paquetes .senda). El visor web de Android
 * ignora las descargas de «blob:», así que la web envía el archivo por trozos en base64 y aquí se escribe:
 * Android 10+ → carpeta pública Descargas/SENDA (MediaStore, sin permisos); Android 8–9 → carpeta de la app.
 */
final class FileSaver {
    private static final long MAX_BYTES = 2L * 1024 * 1024 * 1024; // 2 GB por archivo (límite propio)
    private final Context ctx;
    private final Map<String, Open> open = new HashMap<>();
    private int seq = 0;

    private static final class Open { OutputStream out; Uri uri; File file; long bytes; }

    FileSaver(Context c) { ctx = c.getApplicationContext(); }

    static String safeName(String name) {
        String n = name == null ? "senda" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (n.length() > 80) n = n.substring(n.length() - 80);
        return n.isEmpty() ? "senda" : n;
    }

    synchronized String begin(String name, String mime) throws IOException {
        Open o = new Open();
        String n = safeName(name), m = mime == null ? "application/octet-stream" : mime;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, n);
            v.put(MediaStore.MediaColumns.MIME_TYPE, m);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SENDA");
            ContentResolver r = ctx.getContentResolver();
            o.uri = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (o.uri == null) throw new IOException("MediaStore no creó el archivo");
            o.out = r.openOutputStream(o.uri);
        } else {
            File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            if (dir == null) throw new IOException("sin almacenamiento");
            dir.mkdirs();
            o.file = new File(dir, n);
            o.out = new FileOutputStream(o.file);
        }
        String id = "f" + (++seq);
        open.put(id, o);
        return id;
    }

    synchronized void chunk(String id, String b64) throws IOException {
        Open o = open.get(id);
        if (o == null) throw new IOException("archivo no abierto");
        byte[] b = Base64.decode(b64, Base64.DEFAULT);
        o.bytes += b.length;
        if (o.bytes > MAX_BYTES) { abort(id); throw new IOException("archivo demasiado grande"); }
        o.out.write(b);
    }

    synchronized String end(String id) throws IOException {
        Open o = open.remove(id);
        if (o == null) throw new IOException("archivo no abierto");
        o.out.close();
        return o.uri != null ? "Descargas/SENDA" : o.file.getAbsolutePath();
    }

    synchronized void abort(String id) {
        Open o = open.remove(id);
        if (o == null) return;
        try { o.out.close(); } catch (IOException ignored) { }
        if (o.uri != null) ctx.getContentResolver().delete(o.uri, null, null);
        if (o.file != null) //noinspection ResultOfMethodCallIgnored
            o.file.delete();
    }
}
