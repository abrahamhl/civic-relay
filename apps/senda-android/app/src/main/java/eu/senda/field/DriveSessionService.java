package eu.senda.field;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

/**
 * Servicio en primer plano mientras SENDA vigila o acompaña un trayecto. Siempre visible con su
 * notificación (con botón «Parar»). Solo lee la velocidad GNSS para la máquina de arranque y no
 * guarda ni envía el recorrido.
 */
public final class DriveSessionService extends Service implements LocationListener {
    private static final String TAG = "SendaDrive", CHANNEL = "senda_drive";
    private static final int NOTIFICATION_ID = 7301;
    static final String ACTION_SYNC = "eu.senda.field.drive.SYNC", ACTION_USER_STOP = "eu.senda.field.drive.USER_STOP";
    /** Intervalo de muestreo del reloj interno (no es un umbral de decisión: los umbrales están en DriveAutostart.Params). */
    private static final long TICK_MS = 15_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean listening;
    private final Runnable tick = new Runnable() {
        @Override public void run() { DriveController.get(DriveSessionService.this).event("TICK"); handler.postDelayed(this, TICK_MS); }
    };

    static void sync(Context c, DriveAutostart.State state, boolean session) {
        Intent i = new Intent(c, DriveSessionService.class).setAction(ACTION_SYNC).putExtra("state", state.name()).putExtra("session", session);
        try {
            c.startForegroundService(i);
        } catch (RuntimeException e) {
            // Android 12+ puede negar el arranque desde segundo plano (ForegroundServiceStartNotAllowedException).
            Log.w(TAG, "no se pudo arrancar el servicio en primer plano", e);
        }
    }

    static void stop(Context c) { c.stopService(new Intent(c, DriveSessionService.class)); }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_USER_STOP.equals(intent.getAction())) {
            startInForeground(buildNotification("STOP", false));
            DriveController.get(this).event("USER_STOP");
            return START_NOT_STICKY;
        }
        String state = intent != null ? intent.getStringExtra("state") : null;
        boolean session = intent != null && intent.getBooleanExtra("session", false);
        if (!startInForeground(buildNotification(state, session))) { stopSelf(); return START_NOT_STICKY; }
        startListening();
        return START_NOT_STICKY;
    }

    private boolean startInForeground(Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION_ID, n);
            return true;
        } catch (RuntimeException e) {
            Log.w(TAG, "startForeground rechazado", e);
            return false;
        }
    }

    private Notification buildNotification(String state, boolean session) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "SENDA Drive", NotificationManager.IMPORTANCE_LOW));
        int imm = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, AppActivity.class), imm);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, DriveSessionService.class).setAction(ACTION_USER_STOP), imm);
        String text = session ? "En ruta: SENDA te acompaña. Toca para abrir." : "Comprobando si vas conduciendo…";
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("SENDA Drive")
                .setContentText(text)
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Parar", stop).build())
                .build();
    }

    private void startListening() {
        if (listening) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            try {
                LocationManager lm = getSystemService(LocationManager.class);
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper());
            } catch (RuntimeException e) { Log.w(TAG, "GNSS no disponible", e); }
        }
        handler.postDelayed(tick, TICK_MS);
        listening = true;
    }

    @Override public void onLocationChanged(Location l) { if (l.hasSpeed()) DriveController.get(this).event("SPEED", l.getSpeed()); }
    // Implementadas explícitamente: en Android < 11 la interfaz no trae implementaciones por defecto.
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }
    @SuppressWarnings("deprecation")
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }

    @Override public void onDestroy() {
        handler.removeCallbacks(tick);
        try { getSystemService(LocationManager.class).removeUpdates(this); } catch (RuntimeException ignored) { }
        listening = false;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
