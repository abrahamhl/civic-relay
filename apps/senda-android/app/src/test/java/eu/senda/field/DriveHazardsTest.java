package eu.senda.field;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Pruebas JVM puras para el puente nativo DriveHazards (Android Auto / Copiloto 5D).
 */
public final class DriveHazardsTest {
    private static int checks;
    private static void check(boolean ok, String why) {
        checks++;
        if (!ok) throw new AssertionError(why);
    }

    public static void main(String[] args) {
        DriveHazards.clear();
        AtomicInteger notified = new AtomicInteger();
        DriveHazards.Listener l = snap -> notified.incrementAndGet();
        DriveHazards.addListener(l);

        // 1. Publicación válida desde Copiloto 5D
        String json = "{\"status\":\"ROJO\",\"speedKmh\":104.5,\"recommendedMaxKmh\":55,\"stoppingDistM\":118.4,\"gripReservePct\":18.2,\"rows\":[\"! Frena: curva DERECHA 180 m · máx 55 km/h\",\"▲ Riesgo aquaplaning\"]}";
        boolean ok = DriveHazards.publishFromBridgeJson(json, 1_764_000_000_000L);
        check(ok, "debe aceptar JSON válido del copiloto");
        check(notified.get() == 1, "debe notificar al listener de Android Auto");

        DriveHazards.Snapshot s = DriveHazards.latestSnapshot();
        check(s != null, "snapshot no nulo");
        check("ROJO".equals(s.status), "status ROJO");
        check(Math.abs(s.recommendedMaxKmh - 55.0) < 0.01, "recommendedMaxKmh=55");
        check(Math.abs(s.stoppingDistM - 118.4) < 0.01, "stoppingDistM=118.4");
        check(Math.abs(s.gripReservePct - 18.2) < 0.01, "gripReservePct=18.2");
        check(s.rows.size() == 2, "2 filas activas");
        check(DriveHazards.current().size() == 2, "compatibilidad DriveHazards.current()");
        String sum = s.formatCompactSummary();
        check(sum.contains("Estado ROJO") && sum.contains("Máx 55 km/h") && sum.contains("Parada 118 m") && sum.contains("Agarre 18%"),
                "resumen compacto coherente: " + sum);

        // 2. Caducidad TTL (15 s): nunca deja datos obsoletos como frescos
        check(s.isFresh(1_764_000_010_000L, DriveHazards.DEFAULT_TTL_MS), "fresco a los 10 s");
        check(!s.isFresh(1_764_000_020_000L, DriveHazards.DEFAULT_TTL_MS), "caducado a los 20 s");

        // 3. Saneamiento: caracteres de control, recorte a 120 chars y tope de 6 filas
        StringBuilder many = new StringBuilder("{\"status\":\"AMBAR\",\"rows\":[");
        for (int i = 0; i < 10; i++) {
            if (i > 0) many.append(',');
            many.append("\"Fila\\n").append(i).append(' ').append("X".repeat(160)).append("\"");
        }
        many.append("]}");
        check(DriveHazards.publishFromBridgeJson(many.toString(), 1_764_000_030_000L), "acepta filas largas saneándolas");
        check(DriveHazards.latestSnapshot().rows.size() == DriveHazards.MAX_ROWS, "máximo 6 filas");
        check(DriveHazards.latestSnapshot().rows.get(0).length() <= DriveHazards.MAX_ROW_CHARS, "recorte ≤ 120 chars");
        check(!DriveHazards.latestSnapshot().rows.get(0).contains("\n"), "sin saltos de línea");

        // 4. Rechazo de entradas inválidas o fuera de cuota
        check(!DriveHazards.publishFromBridgeJson(null, 1000L), "rechaza null");
        check(!DriveHazards.publishFromBridgeJson("{\"status\":\"HACKED\"}", 1000L), "rechaza status desconocido");
        check(!DriveHazards.publishFromBridgeJson("{\"status\":\"VERDE\",\"x\":\"" + "A".repeat(5000) + "\"}", 1000L), "rechaza payload > 4096 B");

        // 5. Compatibilidad con set() clásico y limpieza de listener
        DriveHazards.removeListener(l);
        DriveHazards.set(Arrays.asList("Aviso 1", "  \t Aviso 2 \r\n "));
        check(DriveHazards.current().size() == 2 && "Aviso 2".equals(DriveHazards.current().get(1)), "set() sanea y conserva compatibilidad");

        System.out.println("DriveHazardsTest: " + checks + " comprobaciones superadas");
    }
}
