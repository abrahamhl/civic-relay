package eu.senda.field;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Trocea un sobre SENDA en tramas para escribirlas por Bluetooth (GATT) y lo recompone al otro lado.
 * Trama = [id de mensaje (4 B)][índice (2 B)][total (2 B)] + datos. Java puro: se prueba en la JVM.
 * Robusto ante tramas repetidas o desordenadas; descarta mensajes incompletos pasado un tiempo.
 */
public final class MailboxFrames {
    public static final int HEADER = 8;
    public static final int MAX_BYTES = 64 * 1024;          // un sobre SENDA cabe de sobra (límite propio, no del estándar)
    public static final long STALE_MS = 60_000;

    private MailboxFrames() {}

    public static List<byte[]> split(byte[] msg, int msgId, int payloadPerFrame) {
        if (msg == null || msg.length == 0) throw new IllegalArgumentException("mensaje vacío");
        if (msg.length > MAX_BYTES) throw new IllegalArgumentException("mensaje demasiado grande: " + msg.length);
        if (payloadPerFrame < 1) throw new IllegalArgumentException("carga por trama no válida");
        int count = (msg.length + payloadPerFrame - 1) / payloadPerFrame;
        if (count > 0xFFFF) throw new IllegalArgumentException("demasiadas tramas");
        List<byte[]> out = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            int from = i * payloadPerFrame, len = Math.min(payloadPerFrame, msg.length - from);
            byte[] f = new byte[HEADER + len];
            f[0] = (byte) (msgId >>> 24); f[1] = (byte) (msgId >>> 16); f[2] = (byte) (msgId >>> 8); f[3] = (byte) msgId;
            f[4] = (byte) (i >>> 8); f[5] = (byte) i; f[6] = (byte) (count >>> 8); f[7] = (byte) count;
            System.arraycopy(msg, from, f, HEADER, len);
            out.add(f);
        }
        return out;
    }

    /** Recompone mensajes por emisor. No es seguro entre hilos: úsese desde un solo hilo. */
    public static final class Assembler {
        private static final class Part { byte[][] chunks; int have, bytes; long last; }
        private final Map<String, Part> parts = new HashMap<>();
        private final Map<String, Long> done = new HashMap<>();   // completados recientes: sus repeticiones se ignoran

        /** Añade una trama; devuelve el mensaje completo cuando llega la última pieza, o null. */
        public byte[] add(String peer, byte[] f, long nowMs) {
            expire(nowMs);
            if (f == null || f.length <= HEADER) return null;
            int id = ((f[0] & 0xFF) << 24) | ((f[1] & 0xFF) << 16) | ((f[2] & 0xFF) << 8) | (f[3] & 0xFF);
            int idx = ((f[4] & 0xFF) << 8) | (f[5] & 0xFF), count = ((f[6] & 0xFF) << 8) | (f[7] & 0xFF);
            if (count == 0 || idx >= count) return null;
            String key = peer + "#" + id;
            if (done.containsKey(key)) return null;
            Part p = parts.get(key);
            if (p == null) { p = new Part(); p.chunks = new byte[count][]; parts.put(key, p); }
            if (p.chunks.length != count) { parts.remove(key); return null; }   // total incoherente: se descarta
            p.last = nowMs;
            if (p.chunks[idx] != null) return null;                            // repetida
            int len = f.length - HEADER;
            if (p.bytes + len > MAX_BYTES) { parts.remove(key); return null; }
            byte[] c = new byte[len]; System.arraycopy(f, HEADER, c, 0, len);
            p.chunks[idx] = c; p.have++; p.bytes += len;
            if (p.have < count) return null;
            parts.remove(key);
            done.put(key, nowMs);
            ByteArrayOutputStream o = new ByteArrayOutputStream(p.bytes);
            for (byte[] x : p.chunks) o.write(x, 0, x.length);
            return o.toByteArray();
        }

        public int pending() { return parts.size(); }

        private void expire(long nowMs) {
            for (Iterator<Map.Entry<String, Part>> it = parts.entrySet().iterator(); it.hasNext();) {
                if (nowMs - it.next().getValue().last > STALE_MS) it.remove();
            }
            done.values().removeIf(t -> nowMs - t > STALE_MS);
        }
    }
}
