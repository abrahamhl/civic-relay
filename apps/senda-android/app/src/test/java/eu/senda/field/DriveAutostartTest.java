package eu.senda.field;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Conformidad en la JVM pura: DriveAutostart (Java) reproduce línea a línea los vectores generados por la
 * referencia JS. Uso: java eu.senda.field.DriveAutostartTest packages/senda/conformance/drive-autostart.vectors.txt
 */
public final class DriveAutostartTest {
    private static int checks;
    private static void check(boolean ok, String why) { checks++; if (!ok) throw new AssertionError(why); }

    private static double param(String line, String key) {
        for (String kv : line.substring(2).split(" ")) { String[] p = kv.split("="); if (p[0].equals(key)) return Double.parseDouble(p[1]); }
        throw new AssertionError("falta el parámetro " + key);
    }

    public static void main(String[] args) throws Exception {
        List<String> lines = Files.readAllLines(Path.of(args.length > 0 ? args[0] : "packages/senda/conformance/drive-autostart.vectors.txt"), StandardCharsets.UTF_8);
        DriveAutostart m = null; String scenario = null; int scenarios = 0;
        for (String line : lines) {
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (line.startsWith("S ")) { scenario = line.substring(2); scenarios++; continue; }
            if (line.startsWith("P ")) {
                m = new DriveAutostart(new DriveAutostart.Params(param(line, "confirmSpeedMs"), param(line, "confirmWindowS"), param(line, "stopSpeedMs"), param(line, "idleStopS"), param(line, "endGraceS")));
                continue;
            }
            String[] io = line.substring(2).split(" => ");
            String[] in = io[0].split(" ");
            double t = Double.NaN, ms = Double.NaN; Boolean auto = null;
            for (int i = 1; i < in.length; i++) {
                String[] kv = in[i].split("=");
                if (kv[0].equals("t")) t = Double.parseDouble(kv[1]);
                else if (kv[0].equals("ms")) ms = Double.parseDouble(kv[1]);
                else if (kv[0].equals("autoStart")) auto = kv[1].equals("1");
            }
            List<DriveAutostart.Action> acts = m.handle(in[0], t, ms, auto);
            StringBuilder got = new StringBuilder(m.state().name());
            for (DriveAutostart.Action a : acts) got.append(' ').append(a);
            check(got.toString().equals(io[1]), scenario + " · " + io[0] + " → esperado «" + io[1] + "», obtenido «" + got + "»");
        }
        check(scenarios >= 9, "se esperaban al menos 9 escenarios");
        // Veracidad: sin umbrales declarados no se crea.
        boolean threw = false;
        try { new DriveAutostart.Params(Double.NaN, 120, 1.5, 300, 60); } catch (IllegalArgumentException e) { threw = e.getMessage().contains("debe declararse"); }
        check(threw, "un umbral no declarado debe rechazarse");
        System.out.println("DriveAutostartTest: " + checks + " comprobaciones superadas en " + scenarios + " escenarios");
    }
}
