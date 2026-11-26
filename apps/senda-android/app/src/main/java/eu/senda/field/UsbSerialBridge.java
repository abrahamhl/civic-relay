package eu.senda.field;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;

/**
 * Puente nativo Android USB-OTG (solo SDK de Android, cero dependencias externas, sin INTERNET)
 * que reenvía bytes crudos de un adaptador USB-serie (256000 8N1) directamente al analizador
 * `createFrameParser` de `/senda/personas` en la WebView.
 *
 * Privacidad: nunca expone el número de serie hardware del adaptador USB.
 */
public final class UsbSerialBridge {
    private static final String ACTION_USB_PERMISSION = "eu.senda.field.USB_PERMISSION";

    public interface Listener {
        void onData(String base64Chunk);
        void onStatus(String event, String detail);
    }

    private final Context ctx;
    private final UsbManager usb;
    private final Listener listener;

    private UsbDeviceConnection conn;
    private UsbInterface claimedIface;
    private UsbEndpoint epIn;
    private UsbEndpoint epOut;
    private volatile boolean running;
    private Thread readerThread;
    private boolean receiverRegistered;
    private int pendingDeviceId = -1;

    private final BroadcastReceiver permReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            int targetId = pendingDeviceId;
            pendingDeviceId = -1;
            if (!granted) {
                listener.onStatus("error", "Permiso USB denegado por el usuario");
                return;
            }
            if (targetId >= 0) openDeviceById(targetId, UsbSerialCodec.DEFAULT_BAUD);
        }
    };

    public UsbSerialBridge(Context ctx, Listener listener) {
        this.ctx = ctx.getApplicationContext();
        this.usb = (UsbManager) this.ctx.getSystemService(Context.USB_SERVICE);
        this.listener = listener;
    }

    /** Lista adaptadores USB-serie conectados sin revelar números de serie hardware. */
    public String listDevicesJson() {
        JSONArray arr = new JSONArray();
        if (usb == null) return arr.toString();
        Map<String, UsbDevice> map = usb.getDeviceList();
        if (map == null) return arr.toString();
        for (UsbDevice d : map.values()) {
            UsbSerialCodec.Driver drv = detectDeviceDriver(d);
            if (drv == UsbSerialCodec.Driver.UNSUPPORTED) continue;
            JSONObject o = new JSONObject();
            try {
                o.put("deviceId", d.getDeviceId());
                o.put("vendorId", d.getVendorId());
                o.put("productId", d.getProductId());
                o.put("driver", drv.name());
                o.put("name", d.getProductName() != null ? d.getProductName() : drv.name());
                o.put("hasPermission", usb.hasPermission(d));
                arr.put(o);
            } catch (JSONException ignored) {}
        }
        return arr.toString();
    }

    /** Abre el adaptador indicado a 256000 8N1 (pide permiso USB a Android si aún no lo tiene). */
    public synchronized boolean open(int deviceId) {
        return openDeviceById(deviceId, UsbSerialCodec.DEFAULT_BAUD);
    }

    private synchronized boolean openDeviceById(int deviceId, int baudRate) {
        close();
        if (usb == null) {
            listener.onStatus("error", "Este dispositivo Android no expone UsbManager (sin USB-OTG)");
            return false;
        }
        UsbDevice dev = findDevice(deviceId);
        if (dev == null) {
            listener.onStatus("error", "Adaptador USB-serie no encontrado (conecte el cable OTG)");
            return false;
        }
        UsbSerialCodec.Driver drv = detectDeviceDriver(dev);
        if (drv == UsbSerialCodec.Driver.UNSUPPORTED) {
            listener.onStatus("error", "Adaptador USB no reconocido (se soportan CH340, CP210x, FTDI y CDC-ACM)");
            return false;
        }
        if (!usb.hasPermission(dev)) {
            registerReceiverIfNeeded();
            pendingDeviceId = dev.getDeviceId();
            int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, new Intent(ACTION_USB_PERMISSION).setPackage(ctx.getPackageName()), flags);
            usb.requestPermission(dev, pi);
            listener.onStatus("permission", "Acepte el diálogo USB de Android para abrir el radar");
            return true;
        }
        return startStream(dev, drv, baudRate);
    }

    private boolean startStream(UsbDevice dev, UsbSerialCodec.Driver drv, int baudRate) {
        UsbInterface dataIface = findBulkInterface(dev);
        if (dataIface == null) {
            listener.onStatus("error", "El adaptador USB no expone canales bulk IN/OUT");
            return false;
        }
        UsbDeviceConnection c = usb.openDevice(dev);
        if (c == null) {
            listener.onStatus("error", "Android no permitió abrir la conexión USB");
            return false;
        }
        if (!c.claimInterface(dataIface, true)) {
            c.close();
            listener.onStatus("error", "No se pudo reservar la interfaz USB-serie");
            return false;
        }
        UsbEndpoint in = null, out = null;
        for (int i = 0; i < dataIface.getEndpointCount(); i++) {
            UsbEndpoint ep = dataIface.getEndpoint(i);
            if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                if (ep.getDirection() == UsbConstants.USB_DIR_IN) in = ep;
                else out = ep;
            }
        }
        if (in == null) {
            c.releaseInterface(dataIface);
            c.close();
            listener.onStatus("error", "No se encontró endpoint bulk de lectura USB");
            return false;
        }
        configureLineCoding(c, drv, dataIface.getId(), baudRate);
        this.conn = c;
        this.claimedIface = dataIface;
        this.epIn = in;
        this.epOut = out;
        this.running = true;

        final UsbDeviceConnection fConn = c;
        final UsbEndpoint fIn = in;
        final boolean isFtdi = drv == UsbSerialCodec.Driver.FTDI;
        readerThread = new Thread(() -> readLoop(fConn, fIn, isFtdi), "senda-usb-mmwave");
        readerThread.setDaemon(true);
        readerThread.start();
        listener.onStatus("open", "USB-OTG abierto (" + drv.name() + ", " + baudRate + " baudios 8N1)");
        return true;
    }

    private void readLoop(UsbDeviceConnection c, UsbEndpoint in, boolean stripFtdiModemStatus) {
        byte[] buf = new byte[Math.max(64, in.getMaxPacketSize())];
        while (running) {
            int n = c.bulkTransfer(in, buf, buf.length, 250);
            if (n <= 0) continue;
            int offset = (stripFtdiModemStatus && n > 2) ? 2 : 0;
            int len = n - offset;
            if (len <= 0) continue;
            String b64 = Base64.encodeToString(buf, offset, len, Base64.NO_WRAP);
            listener.onData(b64);
        }
    }

    /** Envía bytes en Base64 al radar (órdenes ENABLE_CONFIG / MULTI_TARGET / END_CONFIG). */
    public synchronized boolean writeBase64(String b64) {
        if (!running || conn == null || epOut == null || b64 == null) return false;
        byte[] data;
        try {
            data = Base64.decode(b64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            return false;
        }
        if (data.length == 0 || data.length > 256) return false;
        return conn.bulkTransfer(epOut, data, data.length, 500) == data.length;
    }

    public synchronized void close() {
        running = false;
        if (readerThread != null) {
            readerThread.interrupt();
            readerThread = null;
        }
        if (conn != null) {
            try { if (claimedIface != null) conn.releaseInterface(claimedIface); } catch (RuntimeException ignored) {}
            try { conn.close(); } catch (RuntimeException ignored) {}
            conn = null;
        }
        claimedIface = null;
        epIn = null;
        epOut = null;
    }

    public synchronized void destroy() {
        close();
        if (receiverRegistered) {
            try { ctx.unregisterReceiver(permReceiver); } catch (RuntimeException ignored) {}
            receiverRegistered = false;
        }
    }

    private void configureLineCoding(UsbDeviceConnection c, UsbSerialCodec.Driver drv, int ifaceId, int baud) {
        switch (drv) {
            case CDC_ACM -> {
                byte[] coding = UsbSerialCodec.cdcLineCoding8N1(baud);
                c.controlTransfer(0x21, 0x20, 0, ifaceId, coding, coding.length, 500);
                c.controlTransfer(0x21, 0x22, 0x03, ifaceId, null, 0, 500); // DTR + RTS
            }
            case CP210X -> {
                c.controlTransfer(0x41, 0x00, 0x01, ifaceId, null, 0, 500); // IFC_ENABLE
                byte[] b = UsbSerialCodec.cp210xBaudBytes(baud);
                c.controlTransfer(0x41, 0x1E, 0, ifaceId, b, b.length, 500); // SET_BAUDRATE
                c.controlTransfer(0x41, 0x03, 0x0800, ifaceId, null, 0, 500); // 8N1
            }
            case CH340 -> {
                c.controlTransfer(0x40, 0xA1, 0, 0, null, 0, 500); // init
                int reg = UsbSerialCodec.ch340BaudReg1312(baud);
                c.controlTransfer(0x40, 0x9A, 0x1312, reg, null, 0, 500);
                c.controlTransfer(0x40, 0x9A, 0x2518, 0x00C3, null, 0, 500); // 8N1
            }
            case FTDI -> {
                c.controlTransfer(0x40, 0x00, 0x00, 0, null, 0, 500); // reset
                int[] div = UsbSerialCodec.ftdiBaudDivisor(baud);
                c.controlTransfer(0x40, 0x03, div[0], div[1], null, 0, 500);
                c.controlTransfer(0x40, 0x04, 0x0008, 0, null, 0, 500); // 8N1
            }
            default -> {}
        }
    }

    private UsbDevice findDevice(int deviceId) {
        Map<String, UsbDevice> map = usb.getDeviceList();
        if (map == null) return null;
        for (UsbDevice d : map.values()) {
            if (d.getDeviceId() == deviceId) return d;
        }
        return null;
    }

    private static UsbSerialCodec.Driver detectDeviceDriver(UsbDevice d) {
        int cls = d.getDeviceClass();
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbSerialCodec.Driver drv = UsbSerialCodec.identifyDriver(d.getVendorId(), d.getProductId(), d.getInterface(i).getInterfaceClass());
            if (drv != UsbSerialCodec.Driver.UNSUPPORTED) return drv;
        }
        return UsbSerialCodec.identifyDriver(d.getVendorId(), d.getProductId(), cls);
    }

    private static UsbInterface findBulkInterface(UsbDevice d) {
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbInterface iface = d.getInterface(i);
            boolean hasIn = false;
            for (int e = 0; e < iface.getEndpointCount(); e++) {
                UsbEndpoint ep = iface.getEndpoint(e);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.getDirection() == UsbConstants.USB_DIR_IN) {
                    hasIn = true;
                }
            }
            if (hasIn) return iface;
        }
        return null;
    }

    private void registerReceiverIfNeeded() {
        if (receiverRegistered) return;
        IntentFilter f = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(permReceiver, f, Context.RECEIVER_NOT_EXPORTED);
        else ctx.registerReceiver(permReceiver, f);
        receiverRegistered = true;
    }
}
