package eu.senda.field;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import android.util.Log;

import java.util.List;

/**
 * Une las señales de la plataforma con la máquina DriveAutostart y ejecuta sus acciones.
 * Guarda SOLO en el móvil: el consentimiento de arranque automático y la dirección Bluetooth del coche
 * vinculado. No envía nada por red (la app no tiene permiso de Internet en la versión base).
 */
public final class DriveController {
    private static final String TAG = "SendaDrive";
    /**
     * EJEMPLO DECLARADO, sin fuente verificada: los mismos valores que EXAMPLE_AUTOSTART del núcleo
     * (packages/senda/src/drive-autostart.mjs). Pendientes de calibrar con trayectos reales.
     */
    public static final DriveAutostart.Params EXAMPLE_PARAMS = new DriveAutostart.Params(5, 120, 1.5, 300, 60);
    private static final String PREFS = "senda_drive", K_AUTO = "autoStart", K_CAR = "carAddress";
    private static DriveController instance;

    private final Context app;
    private final DriveAutostart machine;
    private boolean sessionActive;

    public static synchronized DriveController get(Context c) {
        if (instance == null) instance = new DriveController(c.getApplicationContext());
        return instance;
    }

    private DriveController(Context app) {
        this.app = app;
        this.machine = new DriveAutostart(EXAMPLE_PARAMS);
        if (prefs().getBoolean(K_AUTO, false)) machine.handle("CONSENT", now(), Double.NaN, Boolean.TRUE);
    }

    static double now() { return SystemClock.elapsedRealtime() / 1000.0; }
    private SharedPreferences prefs() { return app.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    public boolean autoStartConsented() { return prefs().getBoolean(K_AUTO, false); }
    public String carAddress() { return prefs().getString(K_CAR, null); }
    public boolean sessionActive() { return sessionActive; }
    public synchronized DriveAutostart.State state() { return machine.state(); }

    /** El coche vinculado coincide con la dirección guardada (sin distinguir mayúsculas). */
    public boolean isMyCar(String address) { String mine = carAddress(); return mine != null && address != null && mine.equalsIgnoreCase(address); }

    /** Consentimiento expreso del usuario (pantalla SENDA Drive). carAddress puede ser null si solo se usa la pista de vehículo. */
    public synchronized void setConsent(boolean autoStart, String carAddress) {
        SharedPreferences.Editor e = prefs().edit().putBoolean(K_AUTO, autoStart);
        if (carAddress != null) e.putString(K_CAR, carAddress);
        if (!autoStart) e.remove(K_CAR);
        e.apply();
        apply(machine.handle("CONSENT", now(), Double.NaN, autoStart));
    }

    public synchronized DriveAutostart.State event(String type) { return event(type, Double.NaN); }

    public synchronized DriveAutostart.State event(String type, double ms) {
        apply(machine.handle(type, now(), ms, null));
        return machine.state();
    }

    private void apply(List<DriveAutostart.Action> actions) {
        for (DriveAutostart.Action a : actions) {
            Log.i(TAG, a.toString());
            if (a.type.equals("START_SESSION")) sessionActive = true;
            if (a.type.equals("STOP_SESSION")) sessionActive = false;
        }
        DriveAutostart.State s = machine.state();
        boolean watching = s == DriveAutostart.State.CANDIDATE || s == DriveAutostart.State.DRIVING || s == DriveAutostart.State.ENDING;
        if (watching) {
            // Sin ubicación precisa el servicio de tipo «location» no puede arrancar: se avisa y no se fuerza.
            if (app.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) { Log.w(TAG, "sin permiso de ubicación: no se arranca el servicio"); return; }
            DriveSessionService.sync(app, s, sessionActive);
        } else {
            DriveSessionService.stop(app);
        }
    }
}
