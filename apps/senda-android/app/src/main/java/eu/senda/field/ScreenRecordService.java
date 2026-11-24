package eu.senda.field;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Caja negra · grabación de la PANTALLA de SENDA (interfaz + datos) con MediaProjection, sin audio.
 * Android exige: el usuario acepta cada vez el aviso del sistema «empezar a grabar», y el servicio va en
 * primer plano con notificación visible (tipo mediaProjection) mientras graba. Nada sale del móvil:
 * el MP4 se guarda en Películas/SENDA (Android 10+, sin permisos) o en la carpeta de la app (8–9).
 * Resolución, cadencia y tasa: las pide la app (`QUALITY`); el móvil puede dar menos (POR MEDIR en campo).
 */
public final class ScreenRecordService extends Service {
    static final String ACTION_START = "eu.senda.field.REC_START", ACTION_STOP = "eu.senda.field.REC_STOP";
    static final String EXTRA_CODE = "code", EXTRA_DATA = "data", EXTRA_HIGH = "high";
    private static final String TAG = "SendaScreenRec", CHANNEL = "senda-rec";
    private static final int NOTIFICATION_ID = 7341;

    /** Lo escucha AppActivity para avisar a la web. */
    interface Listener { void event(String event, String detail); }
    static volatile Listener listener;
    static volatile boolean recording;

    private MediaProjection projection;
    private VirtualDisplay display;
    private MediaRecorder recorder;
    private ParcelFileDescriptor pfd;
    private Uri uri;
    private File file;
    private final Handler main = new Handler(Looper.getMainLooper());

    private static void emit(String e, String d) { Listener l = listener; if (l != null) l.event(e, d); }

    @Override public IBinder onBind(Intent i) { return null; }

    @SuppressWarnings("deprecation")
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) { finish(); return START_NOT_STICKY; }
        if (!ACTION_START.equals(intent.getAction()) || recording) return START_NOT_STICKY;
        // Android 14: el servicio debe estar en primer plano ANTES de pedir la proyección.
        try {
            Notification n = notification();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            else startForeground(NOTIFICATION_ID, n);
        } catch (RuntimeException e) { Log.w(TAG, "startForeground", e); emit("error", "Android no dejó abrir la grabación"); stopSelf(); return START_NOT_STICKY; }
        int code = intent.getIntExtra(EXTRA_CODE, 0);
        Intent data = Build.VERSION.SDK_INT >= 33 ? intent.getParcelableExtra(EXTRA_DATA, Intent.class) : intent.getParcelableExtra(EXTRA_DATA);
        boolean high = intent.getBooleanExtra(EXTRA_HIGH, false);
        try { start(code, data, high); }
        catch (Exception e) { Log.w(TAG, "start", e); emit("error", "No se pudo empezar a grabar: " + e.getClass().getSimpleName()); finish(); }
        return START_NOT_STICKY;
    }

    @SuppressWarnings("deprecation")
    private void start(int code, Intent data, boolean high) throws Exception {
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        projection = mpm.getMediaProjection(code, data);
        if (projection == null) throw new IllegalStateException("sin proyección");
        projection.registerCallback(new MediaProjection.Callback() { // obligatorio en Android 14 antes de crear la pantalla virtual
            @Override public void onStop() { main.post(ScreenRecordService.this::finish); }
        }, main);

        DisplayMetrics m = new DisplayMetrics();
        ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(m);
        int longSide = high ? 1920 : 1280; // pedido por la app (regla de la app), igual que la dashcam
        double k = Math.min(1.0, (double) longSide / Math.max(m.widthPixels, m.heightPixels));
        int w = even((int) (m.widthPixels * k)), h = even((int) (m.heightPixels * k));

        recorder = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(this) : new MediaRecorder();
        recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        recorder.setVideoSize(w, h);
        recorder.setVideoFrameRate(30);
        recorder.setVideoEncodingBitRate(high ? 8_000_000 : 3_000_000);
        openOutput();
        if (pfd != null) recorder.setOutputFile(pfd.getFileDescriptor()); else recorder.setOutputFile(file.getAbsolutePath());
        recorder.prepare();
        display = projection.createVirtualDisplay("senda-cajanegra", w, h, m.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recorder.getSurface(), null, null);
        recorder.start();
        recording = true;
        emit("started", w + "x" + h);
    }

    private static int even(int v) { return Math.max(2, v - (v % 2)); }

    private String name() { return "senda-pantalla-" + new SimpleDateFormat("yyyy-MM-dd-HH-mm-ss", Locale.ROOT).format(new Date()) + ".mp4"; }

    private void openOutput() throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Video.Media.DISPLAY_NAME, name());
            v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            v.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/SENDA");
            v.put(MediaStore.Video.Media.IS_PENDING, 1);
            uri = getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IllegalStateException("MediaStore no dio sitio");
            pfd = getContentResolver().openFileDescriptor(uri, "w");
        } else {
            File dir = new File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "SENDA");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("sin carpeta");
            file = new File(dir, name());
        }
    }

    private void finish() {
        boolean was = recording; recording = false;
        try { if (recorder != null && was) recorder.stop(); } catch (RuntimeException e) { Log.w(TAG, "stop", e); was = false; }
        try { if (recorder != null) recorder.release(); } catch (RuntimeException ignored) { }
        recorder = null;
        if (display != null) { display.release(); display = null; }
        if (projection != null) { try { projection.stop(); } catch (RuntimeException ignored) { } projection = null; }
        try { if (pfd != null) pfd.close(); } catch (java.io.IOException ignored) { }
        pfd = null;
        if (uri != null) {
            if (was) { ContentValues v = new ContentValues(); v.put(MediaStore.Video.Media.IS_PENDING, 0); getContentResolver().update(uri, v, null, null); emit("saved", "Películas/SENDA"); }
            else { getContentResolver().delete(uri, null, null); emit("error", "La grabación no llegó a empezar"); }
            uri = null;
        } else if (file != null) { emit(was ? "saved" : "error", was ? file.getAbsolutePath() : "La grabación no llegó a empezar"); file = null; }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() { if (recording) finish(); super.onDestroy(); }

    private Notification notification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "SENDA · caja negra", NotificationManager.IMPORTANCE_LOW));
        int imm = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent stop = PendingIntent.getService(this, 2, new Intent(this, ScreenRecordService.class).setAction(ACTION_STOP), imm);
        PendingIntent open = PendingIntent.getActivity(this, 3, new Intent(this, AppActivity.class), imm);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.presence_video_online)
                .setContentTitle("SENDA graba la pantalla")
                .setContentText("Caja negra del viaje. Toca «Parar» para guardar.")
                .setContentIntent(open).setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Parar", stop).build())
                .build();
    }
}
