package eu.senda.field;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.SystemClock;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Barrido Wi-Fi etiquetado con la posición en el edificio (x, y, planta). Cada lectura sale
 * como una línea JSONL que la web (Coordinar › Barrido Wi-Fi) importa y trilatera.
 *
 * Límites reales del sistema operativo (no se esconden):
 *  - getScanResults() exige ACCESS_FINE_LOCATION y la ubicación del sistema encendida.
 *  - Android 9+ limita startScan() a 4 barridos cada 2 minutos en primer plano; si el SO
 *    lo rechaza, se usan los últimos resultados en caché y se indica en el resumen.
 */
public final class WifiSurveyRecorder {
    public interface Listener { void onLines(List<String> lines, String summary); }

    private final Context ctx;
    private final WifiManager wifi;
    private final ConnectivityManager cm;
    private BroadcastReceiver receiver;
    private Listener listener;
    private double x, y, z;

    public WifiSurveyRecorder(Context c) {
        ctx = c.getApplicationContext();
        wifi = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
        cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    public void setPosition(double x, double y, double z) { this.x = x; this.y = y; this.z = z; }

    @SuppressWarnings("deprecation")
    public void scanHere(Listener l) {
        listener = l;
        if (wifi == null) { l.onLines(new ArrayList<>(), "Este teléfono no tiene Wi-Fi"); return; }
        if (receiver == null) {
            receiver = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    collect(i.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false));
                }
            };
            IntentFilter f = new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
            if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
            else ctx.registerReceiver(receiver, f);
        }
        if (!wifi.startScan()) collect(false); // limitado por el SO: se usan los resultados en caché
    }

    public void release() {
        if (receiver != null) { try { ctx.unregisterReceiver(receiver); } catch (IllegalArgumentException ignored) { } receiver = null; }
    }

    @SuppressWarnings({"deprecation", "MissingPermission"})
    private void collect(boolean fresh) {
        Listener l = listener; if (l == null) return; listener = null;
        List<String> lines = new ArrayList<>();
        List<ScanResult> rs;
        try { rs = wifi.getScanResults(); } catch (SecurityException e) { l.onLines(lines, "Sin permiso de ubicación precisa: Android no entrega el barrido"); return; }

        String connected = null;
        WifiInfo wi = wifi.getConnectionInfo();
        if (wi != null && wi.getBSSID() != null && !"02:00:00:00:00:00".equals(wi.getBSSID())) connected = wi.getBSSID().toLowerCase(Locale.ROOT);
        boolean internet = false;
        Network n = cm == null ? null : cm.getActiveNetwork();
        NetworkCapabilities nc = n == null ? null : cm.getNetworkCapabilities(n);
        if (nc != null) internet = nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);

        long bootWallMs = System.currentTimeMillis() - SystemClock.elapsedRealtime();
        int bad = 0;
        for (ScanResult r : rs) {
            try {
                long tS = (bootWallMs + r.timestamp / 1000L) / 1000L; // timestamp: µs desde el arranque
                String ssid = r.SSID == null || r.SSID.isEmpty() ? null : r.SSID;
                boolean isConn = r.BSSID != null && r.BSSID.equalsIgnoreCase(connected);
                lines.add(SendaFormats.surveyLine(x, y, z, r.BSSID, ssid, r.level, tS, isConn, isConn && internet, "android"));
            } catch (IllegalArgumentException e) { bad++; }
        }
        String s = lines.size() + " routers en (" + x + ", " + y + ", z " + z + ")" + (fresh ? "" : " · barrido limitado por Android: datos en caché") + (bad > 0 ? " · " + bad + " lecturas descartadas" : "");
        l.onLines(lines, s);
    }
}
