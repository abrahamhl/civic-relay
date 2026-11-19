package eu.senda.field;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.util.Collections;

/**
 * Baliza BLE SENDA (anuncio no conectable, sin nombre de dispositivo) y escáner de balizas.
 * Bajo consumo: ráfaga de 5 s cada 60 s (el SO no permite intervalos de 60 s nativos).
 * El escáner sirve al rescatador/vecino: cada baliza oída en una posición se convierte en una
 * fila de barrido «ble:<id>», y la web la trilatera igual que un router.
 */
@SuppressLint("MissingPermission") // los permisos se piden en MainActivity antes de llamar
public final class BleBeacon {
    public interface Status { void on(String text); }
    public interface Heard { void on(SendaFormats.Frame frame, int rssi); }

    private final BluetoothAdapter adapter;
    private final Handler main = new Handler(Looper.getMainLooper());
    private AdvertiseCallback advCb;
    private ScanCallback scanCb;
    private Runnable dutyCycle;

    public BleBeacon(Context c) {
        BluetoothManager bm = (BluetoothManager) c.getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = bm == null ? null : bm.getAdapter();
    }

    public boolean available() { return adapter != null; }
    public boolean radioOn() { return adapter != null && adapter.isEnabled(); }

    public void start(byte[] frame, boolean lowPower, Status st) {
        stop();
        if (!radioOn()) { st.on("Bluetooth apagado: actívalo (Android exige tu toque)"); return; }
        BluetoothLeAdvertiser adv = adapter.getBluetoothLeAdvertiser();
        if (adv == null) { st.on("Este teléfono no puede emitir balizas BLE"); return; }
        AdvertiseSettings s = new AdvertiseSettings.Builder()
                .setAdvertiseMode(lowPower ? AdvertiseSettings.ADVERTISE_MODE_LOW_POWER : AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(lowPower ? AdvertiseSettings.ADVERTISE_TX_POWER_LOW : AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false).setTimeout(0).build();
        AdvertiseData d = new AdvertiseData.Builder().setIncludeDeviceName(false).setIncludeTxPowerLevel(false)
                .addManufacturerData(SendaFormats.COMPANY_ID, frame).build();
        advCb = new AdvertiseCallback() {
            @Override public void onStartSuccess(AdvertiseSettings e) { st.on(lowPower ? "Baliza de bajo consumo activa (5 s cada 60 s)" : "Baliza activa: los rescatadores pueden localizarte"); }
            @Override public void onStartFailure(int code) { st.on("Android rechazó la baliza (código " + code + ")"); }
        };
        adv.startAdvertising(s, d, advCb);
        if (lowPower) {
            dutyCycle = new Runnable() {
                boolean on = true;
                @Override public void run() {
                    if (advCb == null) return;
                    if (on) adv.stopAdvertising(advCb); else adv.startAdvertising(s, d, advCb);
                    on = !on;
                    main.postDelayed(this, on ? 5_000 : 55_000);
                }
            };
            main.postDelayed(dutyCycle, 5_000);
        }
    }

    public void stop() {
        if (dutyCycle != null) { main.removeCallbacks(dutyCycle); dutyCycle = null; }
        if (advCb != null && adapter != null) {
            BluetoothLeAdvertiser adv = adapter.getBluetoothLeAdvertiser();
            if (adv != null) try { adv.stopAdvertising(advCb); } catch (IllegalStateException ignored) { }
        }
        advCb = null;
    }

    /** Escucha balizas SENDA durante `ms` milisegundos. */
    public void listen(long ms, Heard heard, Status st) {
        if (!radioOn()) { st.on("Bluetooth apagado: actívalo (Android exige tu toque)"); return; }
        BluetoothLeScanner sc = adapter.getBluetoothLeScanner();
        if (sc == null) { st.on("Este teléfono no puede escanear BLE"); return; }
        ScanFilter f = new ScanFilter.Builder().setManufacturerData(SendaFormats.COMPANY_ID, new byte[]{0x53, 0x4E}, new byte[]{(byte) 0xFF, (byte) 0xFF}).build();
        ScanSettings s = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanCb = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult r) {
                ScanRecord rec = r.getScanRecord(); if (rec == null) return;
                SendaFormats.Frame fr = SendaFormats.decodeFrame(rec.getManufacturerSpecificData(SendaFormats.COMPANY_ID));
                if (fr != null) heard.on(fr, r.getRssi());
            }
            @Override public void onScanFailed(int code) { st.on("Android rechazó el escaneo (código " + code + ")"); }
        };
        sc.startScan(Collections.singletonList(f), s, scanCb);
        st.on("Escuchando balizas " + (ms / 1000) + " s…");
        final ScanCallback cb = scanCb;
        main.postDelayed(() -> { try { sc.stopScan(cb); } catch (IllegalStateException ignored) { } st.on("Escucha terminada"); }, ms);
    }
}
