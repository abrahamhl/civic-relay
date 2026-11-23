package eu.senda.field;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Buzón SENDA por Bluetooth LE (GATT), sin Internet y sin servicios de Google: funciona en modo avión
 * con el Bluetooth encendido. Cada móvil con el buzón activo anuncia el servicio SENDA y acepta sobres
 * cifrados (que no puede leer si no son para él: los guarda y los lleva, como el resto de SENDA).
 * Para enviar, busca móviles SENDA cercanos durante unos segundos y escribe el sobre por tramas.
 *
 * Alcance y velocidad: POR MEDIR en campo (prueba guiada 1). No se dan cifras sin medida.
 */
@SuppressLint("MissingPermission") // AppActivity pide los permisos de Bluetooth antes de llamar
public final class BleMailbox {
    public static final UUID SERVICE = UUID.fromString("5e7da001-8c3e-4f6a-9b1d-2c0f5e9a4b11");
    public static final UUID INBOX = UUID.fromString("5e7da002-8c3e-4f6a-9b1d-2c0f5e9a4b11");
    private static final int MAX_PEERS = 8;
    private static final int WANT_MTU = 517;

    public interface Listener { void received(byte[] msg, String from); void status(String text); }

    private final Context ctx;
    private final BluetoothManager bm;
    private final BluetoothAdapter adapter;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final MailboxFrames.Assembler assembler = new MailboxFrames.Assembler();
    private final SecureRandom rnd = new SecureRandom();
    private final Listener listener;
    private BluetoothGattServer server;
    private AdvertiseCallback advCb;
    private boolean sending;

    public BleMailbox(Context c, Listener l) {
        ctx = c.getApplicationContext();
        bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = bm == null ? null : bm.getAdapter();
        listener = l;
    }

    private void status(String s) { main.post(() -> listener.status(s)); }
    public boolean radioOn() { return adapter != null && adapter.isEnabled(); }
    public boolean running() { return server != null; }

    /** Abre el buzón: servidor GATT + anuncio conectable con el servicio SENDA. */
    public void start() {
        if (server != null) { status("El buzón Bluetooth ya está activo"); return; }
        if (!radioOn()) { status("Bluetooth apagado: actívalo (también se puede en modo avión)"); return; }
        server = bm.openGattServer(ctx, new BluetoothGattServerCallback() {
            @Override public void onCharacteristicWriteRequest(BluetoothDevice dev, int reqId, BluetoothGattCharacteristic ch,
                                                             boolean prepared, boolean needResp, int offset, byte[] value) {
                if (needResp && server != null) server.sendResponse(dev, reqId, BluetoothGatt.GATT_SUCCESS, 0, null);
                if (!INBOX.equals(ch.getUuid()) || value == null) return;
                final String from = dev.getAddress();
                main.post(() -> {
                    byte[] msg = assembler.add(from, value, System.currentTimeMillis());
                    if (msg != null) listener.received(msg, from);
                });
            }
        });
        if (server == null) { status("Este móvil no permite abrir el buzón Bluetooth"); return; }
        BluetoothGattService svc = new BluetoothGattService(SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        svc.addCharacteristic(new BluetoothGattCharacteristic(INBOX,
                BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE));
        server.addService(svc);
        BluetoothLeAdvertiser adv = adapter.getBluetoothLeAdvertiser();
        if (adv == null) { status("Buzón abierto, pero este móvil no puede anunciarse: otros no lo encontrarán"); return; }
        AdvertiseSettings s = new AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH).setConnectable(true).setTimeout(0).build();
        AdvertiseData d = new AdvertiseData.Builder().setIncludeDeviceName(false).addServiceUuid(new ParcelUuid(SERVICE)).build();
        advCb = new AdvertiseCallback() {
            @Override public void onStartSuccess(AdvertiseSettings e) { status("Buzón Bluetooth activo: otros móviles SENDA cercanos pueden dejarte mensajes"); }
            @Override public void onStartFailure(int code) { status("Android rechazó el anuncio del buzón (código " + code + ")"); }
        };
        adv.startAdvertising(s, d, advCb);
    }

    public void stop() {
        if (advCb != null && adapter != null && adapter.getBluetoothLeAdvertiser() != null) adapter.getBluetoothLeAdvertiser().stopAdvertising(advCb);
        advCb = null;
        if (server != null) { server.close(); server = null; }
    }

    /** Busca móviles SENDA cercanos durante scanMs y entrega `msg` a cada uno (hasta MAX_PEERS). */
    public void send(byte[] msg, long scanMs) {
        if (!radioOn()) { status("Bluetooth apagado: actívalo"); return; }
        if (sending) { status("Ya hay un envío en curso"); return; }
        BluetoothLeScanner sc = adapter.getBluetoothLeScanner();
        if (sc == null) { status("Este móvil no puede buscar por Bluetooth"); return; }
        sending = true;
        final Map<String, BluetoothDevice> found = new LinkedHashMap<>();
        ScanCallback cb = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult r) {
                if (found.size() < MAX_PEERS) found.put(r.getDevice().getAddress(), r.getDevice());
            }
            @Override public void onScanFailed(int code) { status("Android rechazó la búsqueda (código " + code + ")"); }
        };
        ScanFilter f = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build();
        sc.startScan(Collections.singletonList(f), new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), cb);
        status("Buscando móviles SENDA cercanos (" + (scanMs / 1000) + " s)…");
        main.postDelayed(() -> {
            try { sc.stopScan(cb); } catch (IllegalStateException ignored) { }
            if (found.isEmpty()) { sending = false; status("No hay móviles SENDA con el buzón activo cerca"); return; }
            deliverAll(new ArrayDeque<>(found.values()), msg, 0, found.size());
        }, scanMs);
    }

    private void deliverAll(ArrayDeque<BluetoothDevice> queue, byte[] msg, int ok, int total) {
        BluetoothDevice dev = queue.poll();
        if (dev == null) { sending = false; status("Entregado a " + ok + " de " + total + " móviles cercanos"); return; }
        status("Entregando al móvil " + (total - queue.size()) + " de " + total + "…");
        deliver(dev, msg, success -> main.post(() -> deliverAll(queue, msg, ok + (success ? 1 : 0), total)));
    }

    private interface Done { void on(boolean ok); }

    private void deliver(BluetoothDevice dev, byte[] msg, Done done) {
        final int msgId = rnd.nextInt();
        final boolean[] finished = { false };
        final Runnable[] watchdog = new Runnable[1];
        BluetoothGattCallback gcb = new BluetoothGattCallback() {
            List<byte[]> frames; int next; BluetoothGattCharacteristic inbox;
            void finish(BluetoothGatt g, boolean ok) {
                if (finished[0]) return; finished[0] = true;
                main.removeCallbacks(watchdog[0]);
                try { g.disconnect(); g.close(); } catch (RuntimeException ignored) { }
                done.on(ok);
            }
            @Override public void onConnectionStateChange(BluetoothGatt g, int st, int state) {
                if (state == BluetoothProfile.STATE_CONNECTED && st == BluetoothGatt.GATT_SUCCESS) { if (!g.requestMtu(WANT_MTU)) g.discoverServices(); }
                else if (state == BluetoothProfile.STATE_DISCONNECTED) finish(g, frames != null && next >= frames.size());
            }
            @Override public void onMtuChanged(BluetoothGatt g, int mtu, int st) {
                frames = MailboxFrames.split(msg, msgId, Math.max(12, mtu - 3) - MailboxFrames.HEADER);
                g.discoverServices();
            }
            @Override public void onServicesDiscovered(BluetoothGatt g, int st) {
                BluetoothGattService s = g.getService(SERVICE);
                inbox = s == null ? null : s.getCharacteristic(INBOX);
                if (inbox == null) { finish(g, false); return; }
                if (frames == null) frames = MailboxFrames.split(msg, msgId, 20 - MailboxFrames.HEADER); // MTU por defecto 23 → 20 B por escritura
                writeNext(g);
            }
            @Override public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int st) {
                if (st != BluetoothGatt.GATT_SUCCESS) { finish(g, false); return; }
                next++;
                if (next >= frames.size()) finish(g, true); else writeNext(g);
            }
            @SuppressWarnings("deprecation")
            void writeNext(BluetoothGatt g) {
                byte[] f = frames.get(next);
                boolean queued;
                if (Build.VERSION.SDK_INT >= 33) queued = g.writeCharacteristic(inbox, f, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothGatt.GATT_SUCCESS;
                else { inbox.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT); inbox.setValue(f); queued = g.writeCharacteristic(inbox); }
                if (!queued) finish(g, false);
            }
        };
        BluetoothGatt gatt = dev.connectGatt(ctx, false, gcb, BluetoothDevice.TRANSPORT_LE);
        watchdog[0] = () -> { if (!finished[0]) { finished[0] = true; try { gatt.disconnect(); gatt.close(); } catch (RuntimeException ignored) { } done.on(false); } };
        main.postDelayed(watchdog[0], 20_000);
    }
}
