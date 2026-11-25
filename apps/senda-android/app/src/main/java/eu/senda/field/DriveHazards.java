package eu.senda.field;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Puente en memoria (Java puro, sin dependencias Android, 0 PII) entre el motor SENDA Copiloto 5D /
 * Conducir (WebView) y las pantallas nativas (notificación de trayecto y Android Auto `DriveCarScreen`).
 *
 * Reglas de veracidad y seguridad:
 *  - Cada instantánea incluye marca temporal (`updatedAtMs`) y caduca tras `DEFAULT_TTL_MS` (15 s)
 *    para no mostrar nunca avisos obsoletos en el salpicadero del coche.
 *  - Sanea todas las cadenas (máximo 6 filas, 120 caracteres por fila, sin caracteres de control) y
 *    restringe el estado a `VERDE | AMBAR | ROJO`.
 */
public final class DriveHazards {
    public static final int MAX_ROWS = 6;
    public static final int MAX_ROW_CHARS = 120;
    public static final long DEFAULT_TTL_MS = 15_000L;

    public interface Listener {
        void onDriveStateChanged(Snapshot snapshot);
    }

    public static final class Snapshot {
        public final String status;               // VERDE | AMBAR | ROJO
        public final double speedKmh;             // NaN si no disponible
        public final double recommendedMaxKmh;    // NaN si no aplica
        public final double stoppingDistM;        // NaN si no disponible
        public final double gripReservePct;       // NaN si no disponible
        public final long updatedAtMs;
        public final List<String> rows;

        public Snapshot(String status, double speedKmh, double recommendedMaxKmh,
                        double stoppingDistM, double gripReservePct, long updatedAtMs, List<String> rows) {
            this.status = status;
            this.speedKmh = speedKmh;
            this.recommendedMaxKmh = recommendedMaxKmh;
            this.stoppingDistM = stoppingDistM;
            this.gripReservePct = gripReservePct;
            this.updatedAtMs = updatedAtMs;
            this.rows = Collections.unmodifiableList(new ArrayList<>(rows));
        }

        public boolean isFresh(long nowMs, long ttlMs) {
            return updatedAtMs > 0L && nowMs >= updatedAtMs && (nowMs - updatedAtMs) <= ttlMs;
        }

        public String formatCompactSummary() {
            StringBuilder sb = new StringBuilder();
            sb.append("Estado ").append(status);
            if (Double.isFinite(recommendedMaxKmh)) {
                sb.append(String.format(java.util.Locale.ROOT, " · Máx %.0f km/h", recommendedMaxKmh));
            }
            if (Double.isFinite(stoppingDistM)) {
                sb.append(String.format(java.util.Locale.ROOT, " · Parada %.0f m", stoppingDistM));
            }
            if (Double.isFinite(gripReservePct)) {
                sb.append(String.format(java.util.Locale.ROOT, " · Agarre %.0f%%", gripReservePct));
            }
            return sb.toString();
        }
    }

    private static final List<String> HAZARDS = new ArrayList<>();
    private static Snapshot LATEST = null;
    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();

    private static final Pattern STR_STATUS = Pattern.compile("\"status\"\\s*:\\s*\"(VERDE|AMBAR|ROJO|INFO)\"");
    private static final Pattern NUM_SPEED = Pattern.compile("\"speedKmh\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern NUM_MAX = Pattern.compile("\"recommendedMaxKmh\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern NUM_SSD = Pattern.compile("\"stoppingDistM\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern NUM_GRIP = Pattern.compile("\"gripReservePct\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
    private static final Pattern ARR_ROWS = Pattern.compile("\"rows\"\\s*:\\s*\\[(.*?)\\]", Pattern.DOTALL);
    private static final Pattern QUOTED = Pattern.compile("\"((?:[^\"\\\\]|\\\\.)*)\"");

    private DriveHazards() { }

    public static void addListener(Listener l) {
        if (l != null) LISTENERS.addIfAbsent(l);
    }

    public static void removeListener(Listener l) {
        if (l != null) LISTENERS.remove(l);
    }

    public static synchronized void set(List<String> hazards) {
        HAZARDS.clear();
        if (hazards != null) {
            for (String h : hazards) {
                if (HAZARDS.size() >= MAX_ROWS) break;
                String clean = sanitizeRow(h);
                if (!clean.isEmpty()) HAZARDS.add(clean);
            }
        }
    }

    public static synchronized List<String> current() {
        return Collections.unmodifiableList(new ArrayList<>(HAZARDS));
    }

    public static synchronized Snapshot latestSnapshot() {
        return LATEST;
    }

    public static synchronized void clear() {
        HAZARDS.clear();
        LATEST = null;
    }

    /**
     * Valida y publica una instantánea JSON compacta emitida por `drive-copilot-physics.mjs` o `conducir.mjs`.
     * Devuelve `false` si el JSON está vacío, excede 4096 bytes o no contiene un estado válido.
     */
    public static boolean publishFromBridgeJson(String json, long nowMs) {
        if (json == null || json.isEmpty() || json.length() > 4096 || nowMs <= 0L) return false;
        Matcher ms = STR_STATUS.matcher(json);
        if (!ms.find()) return false;
        String rawStatus = ms.group(1);
        String status = "INFO".equals(rawStatus) ? "VERDE" : rawStatus;
        double speed = parseNum(NUM_SPEED, json, 0.0, 400.0);
        double recMax = parseNum(NUM_MAX, json, 0.0, 300.0);
        double ssd = parseNum(NUM_SSD, json, 0.0, 2000.0);
        double grip = parseNum(NUM_GRIP, json, 0.0, 100.0);

        List<String> rows = new ArrayList<>();
        Matcher ma = ARR_ROWS.matcher(json);
        if (ma.find()) {
            Matcher mq = QUOTED.matcher(ma.group(1));
            while (mq.find() && rows.size() < MAX_ROWS) {
                String clean = sanitizeRow(unescapeJsonString(mq.group(1)));
                if (!clean.isEmpty()) rows.add(clean);
            }
        }

        Snapshot snap = new Snapshot(status, speed, recMax, ssd, grip, nowMs, rows);
        synchronized (DriveHazards.class) {
            HAZARDS.clear();
            HAZARDS.addAll(rows);
            LATEST = snap;
        }
        for (Listener l : LISTENERS) {
            try { l.onDriveStateChanged(snap); } catch (RuntimeException ignored) { }
        }
        return true;
    }

    private static double parseNum(Pattern p, String json, double min, double max) {
        Matcher m = p.matcher(json);
        if (!m.find()) return Double.NaN;
        try {
            double v = Double.parseDouble(m.group(1));
            return (Double.isFinite(v) && v >= min && v <= max) ? v : Double.NaN;
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    private static String unescapeJsonString(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", " ").replace("\\r", " ").replace("\\t", " ");
    }

    static String sanitizeRow(String raw) {
        if (raw == null) return "";
        StringBuilder sb = new StringBuilder(Math.min(raw.length(), MAX_ROW_CHARS));
        for (int i = 0; i < raw.length() && sb.length() < MAX_ROW_CHARS; i++) {
            char c = raw.charAt(i);
            if (c < 0x20 || c == 0x7f) sb.append(' ');
            else sb.append(c);
        }
        return sb.toString().trim().replaceAll("\\s{2,}", " ");
    }
}
