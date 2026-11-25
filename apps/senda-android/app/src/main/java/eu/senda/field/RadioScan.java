package eu.senda.field;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * «Señales a tu alrededor»: cuenta las redes Wi-Fi y los dispositivos Bluetooth cercanos y su intensidad,
 * para dibujarlos en un radar y medir la cobertura del mallado SENDA andando, en bici o en coche.
 *
 * Privacidad por diseño: a la web NO salen nombres de red (SSID), ni direcciones (BSSID/MAC). Cada emisor
 * se convierte aquí en un ángulo de dibujo con una sal aleatoria de la sesión (el mismo emisor cae en el
 * mismo sitio mientras la app está abierta, pero no se puede reconocer entre sesiones ni entre móviles).
 * El ángulo es decorativo: un móvil NO sabe en qué dirección está cada emisor. Solo la intensidad es medida.
 * Android limita los barridos Wi-Fi (4 cada 2 min en primer plano): si no deja, se usa su caché y se dice.
 */
@SuppressLint("MissingPermission") // AppActivity pide ubicación y Bluetooth antes de llamar
final class RadioScan {
    interface Done { void result(JSONObject o); }

    private static final long BLE_MS = 4000;
    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final long salt = new SecureRandom().nextLong();
    private boolean busy;

    RadioScan(Context c) { ctx = c.getApplicationContext(); }

    /** Ángulo 0–359 a partir de la dirección y la sal de la sesión (no reversible a la dirección). */
    static int angleOf(long salt, String addr) {
        long h = salt ^ 0x9E3779B97F4A7C15L;
        for (int i = 0; i < addr.length(); i++) { h ^= addr.charAt(i); h *= 0x100000001B3L; h ^= (h >>> 29); }
        return (int) Math.floorMod(h, 360L);
    }

    /** Banda por frecuencia en MHz. */
    static String band(int mhz) { return mhz >= 5925 ? "6" : mhz >= 4900 ? "5" : "2.4"; }

    @SuppressWarnings("deprecation")
    void scan(Done done) {
        if (busy) return;
        busy = true;
        final JSONObject out = new JSONObject();
        final JSONArray wifi = new JSONArray(), ble = new JSONArray();
        boolean fresh = false;
        String note = "";
        final WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
        if (wm == null) note = "sin Wi-Fi";
        else {
            try { fresh = wm.startScan(); } // Android termina el barrido en 2–4 s; si lo limita, devuelve false
            catch (SecurityException e) { note = "sin permiso de ubicación precisa: Android no entrega las redes Wi-Fi"; }
        }
        final boolean freshF = fresh; final String noteF = note;
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter a = bm == null ? null : bm.getAdapter();
        BluetoothLeScanner sc = a != null && a.isEnabled() ? a.getBluetoothLeScanner() : null;
        final Map<String, int[]> seen = new HashMap<>(); // dir → {rssi, esSenda}
        final ParcelUuid senda = new ParcelUuid(BleMailbox.SERVICE);
        final ScanCallback cb = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult r) {
                boolean isSenda = r.getScanRecord() != null && r.getScanRecord().getServiceUuids() != null && r.getScanRecord().getServiceUuids().contains(senda);
                int[] prev = seen.get(r.getDevice().getAddress());
                seen.put(r.getDevice().getAddress(), new int[] { prev == null ? r.getRssi() : Math.max(prev[0], r.getRssi()), isSenda || (prev != null && prev[1] == 1) ? 1 : 0 });
            }
        };
        boolean bleOn = false;
        if (sc != null) {
            try { sc.startScan(null, new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), cb); bleOn = true; }
            catch (SecurityException | IllegalStateException ignored) { }
        }
        final boolean bleOnF = bleOn;
        main.postDelayed(() -> { try {
            if (bleOnF) { try { sc.stopScan(cb); } catch (SecurityException | IllegalStateException ignored) { } }
            int sendaN = 0;
            String note2 = noteF; long newestUs = 0;
            // Wi-Fi: se lee AL FINAL de la ventana (antes se leía nada más pedir el barrido y salía el anterior)
            if (wm != null) {
                try {
                    for (android.net.wifi.ScanResult r : wm.getScanResults()) {
                        if (r.BSSID == null) continue;
                        newestUs = Math.max(newestUs, r.timestamp);
                        wifi.put(new JSONObject().put("a", angleOf(salt, r.BSSID)).put("r", r.level).put("g", band(r.frequency)));
                    }
                } catch (SecurityException e) { note2 = "sin permiso de ubicación precisa: Android no entrega las redes Wi-Fi"; }
                catch (JSONException ignored) { }
            }
            long ageS = newestUs > 0 ? Math.max(0, (android.os.SystemClock.elapsedRealtime() * 1000L - newestUs) / 1_000_000L) : -1;
            try {
                for (Map.Entry<String, int[]> e : seen.entrySet()) {
                    ble.put(new JSONObject().put("a", angleOf(salt, e.getKey())).put("r", e.getValue()[0]).put("s", e.getValue()[1] == 1));
                    if (e.getValue()[1] == 1) sendaN++;
                }
                out.put("wifi", wifi).put("ble", ble).put("sendaNear", sendaN).put("wifiFresh", freshF)
                   .put("bleOn", bleOnF).put("bleMs", BLE_MS).put("note", note2).put("wifiAgeS", ageS).put("t", System.currentTimeMillis());
            } catch (JSONException ignored) { }
            busy = false;
            done.result(out);
        } catch (RuntimeException e) { // nunca dejar el radar bloqueado: se responde vacío con el motivo
            busy = false;
            JSONObject err = new JSONObject();
            try { err.put("wifi", new JSONArray()).put("ble", new JSONArray()).put("note", "fallo del barrido: " + e.getClass().getSimpleName()); } catch (JSONException ignored) { }
            done.result(err);
        } }, bleOn ? BLE_MS : 3500); // sin Bluetooth se espera igual a que termine el barrido Wi-Fi
    }
}
