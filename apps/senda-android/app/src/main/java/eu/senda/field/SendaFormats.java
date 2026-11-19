package eu.senda.field;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/**
 * Formatos compartidos con la web (packages/senda/src/beacon.mjs) y el ESP32
 * (hardware/esp32-survey). Java puro: se prueba en la JVM sin Android.
 *
 * Trama de baliza (18 bytes, Manufacturer Specific Data):
 * 'S''N' | versión 1 | estado | batería (255=?) | planta int8 (-128=?) | unidad ASCII |
 * id 8 bytes = SHA-256(huella)[0..7] | secuencia BE 2 bytes | CRC-8 (poli 0x07) de 0..16.
 * COMPANY_ID 0xFFFF = identificador de PRUEBAS del Bluetooth SIG (cambiar en despliegue real).
 */
public final class SendaFormats {
    private SendaFormats() {}

    public static final int COMPANY_ID = 0xFFFF;
    public static final int FRAME_LEN = 18;
    public static final String[] STATUS = {"UNKNOWN", "SAFE", "NEED_HELP", "TRAPPED", "AWAY", "NO_RESPONSE"};

    public static int crc8(byte[] b, int end) {
        int c = 0;
        for (int i = 0; i < end; i++) {
            c ^= b[i] & 0xFF;
            for (int k = 0; k < 8; k++) c = (c & 0x80) != 0 ? ((c << 1) ^ 0x07) & 0xFF : (c << 1) & 0xFF;
        }
        return c;
    }

    public static String hex(byte[] b, int from, int to) {
        StringBuilder s = new StringBuilder();
        for (int i = from; i < to; i++) s.append(String.format(Locale.ROOT, "%02x", b[i] & 0xFF));
        return s.toString();
    }

    public static byte[] unhex(String h) {
        if (h == null || h.length() % 2 != 0 || !h.matches("[0-9a-fA-F]*")) throw new IllegalArgumentException("hex no válido");
        byte[] out = new byte[h.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(h.substring(2 * i, 2 * i + 2), 16);
        return out;
    }

    /** Id de baliza = primeros 8 bytes de SHA-256(huella), en hex. Igual que beaconIdOf() en la web. */
    public static String beaconIdOf(String fingerprint) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(fingerprint.getBytes(StandardCharsets.UTF_8));
            return hex(d, 0, 8);
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public static int statusCode(String status) {
        for (int i = 0; i < STATUS.length; i++) if (STATUS[i].equals(status)) return i;
        throw new IllegalArgumentException("Estado no válido: " + status);
    }

    /** @param battery 0-100 o null · @param floor planta o null · @param unit letra o null */
    public static byte[] encodeFrame(String status, Integer battery, Integer floor, Character unit, String beaconId, int seq) {
        if (beaconId == null || !beaconId.matches("[0-9a-f]{16}")) throw new IllegalArgumentException("beaconId debe ser 16 hex");
        byte[] f = new byte[FRAME_LEN];
        f[0] = 0x53; f[1] = 0x4E; f[2] = 1; f[3] = (byte) statusCode(status);
        f[4] = (byte) (battery == null ? 255 : Math.max(0, Math.min(100, battery)));
        f[5] = (byte) (floor == null ? 0x80 : Math.max(-127, Math.min(127, floor)));
        f[6] = (byte) (unit == null ? 0 : (unit & 0x7F));
        System.arraycopy(unhex(beaconId), 0, f, 7, 8);
        f[15] = (byte) ((seq >> 8) & 0xFF); f[16] = (byte) (seq & 0xFF);
        f[17] = (byte) crc8(f, 17);
        return f;
    }

    /** Trama decodificada o null si no es SENDA, la versión no coincide o el CRC falla. */
    public static Frame decodeFrame(byte[] f) {
        if (f == null || f.length != FRAME_LEN || f[0] != 0x53 || f[1] != 0x4E || f[2] != 1) return null;
        if (crc8(f, 17) != (f[17] & 0xFF)) return null;
        int st = f[3] & 0xFF;
        Integer battery = (f[4] & 0xFF) == 255 ? null : (f[4] & 0xFF);
        Integer floor = (f[5] & 0xFF) == 0x80 ? null : (int) f[5];
        Character unit = f[6] == 0 ? null : (char) f[6];
        return new Frame(st < STATUS.length ? STATUS[st] : "UNKNOWN", battery, floor, unit, hex(f, 7, 15), ((f[15] & 0xFF) << 8) | (f[16] & 0xFF));
    }

    public static final class Frame {
        public final String status; public final Integer battery; public final Integer floor; public final Character unit; public final String beaconId; public final int seq;
        Frame(String status, Integer battery, Integer floor, Character unit, String beaconId, int seq) {
            this.status = status; this.battery = battery; this.floor = floor; this.unit = unit; this.beaconId = beaconId; this.seq = seq;
        }
    }

    /* ---------- barrido (JSONL) compatible con building-twin.locateAccessPoints ---------- */
    public static final double FLOOR_HEIGHT_M = 3.0;

    /** z en metros para una planta y una altura sobre el suelo de esa planta (por defecto, mano: 1,2 m). */
    public static double zFor(int floor, double heightInFloorM) { return floor * FLOOR_HEIGHT_M + heightInFloorM; }

    public static String normalizeBssid(String b) {
        if (b == null) throw new IllegalArgumentException("bssid vacío");
        String s = b.trim().toLowerCase(Locale.ROOT);
        if (s.startsWith("ble:")) { if (!s.matches("ble:[0-9a-f]{16}")) throw new IllegalArgumentException("id BLE no válido"); return s; }
        if (!s.matches("([0-9a-f]{2}:){5}[0-9a-f]{2}")) throw new IllegalArgumentException("bssid no válido: " + b);
        return s;
    }

    static String jsonString(String s) {
        if (s == null) return "null";
        StringBuilder o = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': o.append("\\\""); break;
                case '\\': o.append("\\\\"); break;
                case '\n': o.append("\\n"); break;
                case '\r': o.append("\\r"); break;
                case '\t': o.append("\\t"); break;
                default: if (c < 0x20) o.append(String.format(Locale.ROOT, "\\u%04x", (int) c)); else o.append(c);
            }
        }
        return o.append('"').toString();
    }

    static String num(double v) {
        if (!Double.isFinite(v)) throw new IllegalArgumentException("número no finito");
        if (v == Math.rint(v) && Math.abs(v) < 1e15) return Long.toString((long) v);
        return Double.toString(v);
    }

    /** Una lectura → una línea JSON. t en segundos epoch. Lanza si algo no es válido (nunca exporta basura). */
    public static String surveyLine(double x, double y, double z, String bssid, String ssid, int rssi, long tSeconds, boolean connected, boolean internet, String source) {
        if (rssi > 0 || rssi < -127) throw new IllegalArgumentException("rssi fuera de rango: " + rssi);
        StringBuilder s = new StringBuilder("{");
        s.append("\"x\":").append(num(x)).append(",\"y\":").append(num(y)).append(",\"z\":").append(num(z));
        s.append(",\"bssid\":").append(jsonString(normalizeBssid(bssid)));
        s.append(",\"ssid\":").append(jsonString(ssid));
        s.append(",\"rssi\":").append(rssi).append(",\"t\":").append(tSeconds);
        if (connected) s.append(",\"connected\":true,\"internet\":").append(internet);
        if (source != null) s.append(",\"source\":").append(jsonString(source));
        return s.append('}').toString();
    }
}
