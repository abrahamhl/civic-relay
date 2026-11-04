package eu.senda.field;

import java.net.URI;
import java.net.URLDecoder;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Enlace senda://accion?... que abre la web (packages/senda/src/beacon.mjs → nativeActionLink)
 * cuando una alerta firmada pide acciones que el navegador no puede hacer.
 * La firma de la alerta YA se verificó en la web; aquí solo se acepta una lista blanca de
 * acciones inocuas y SIEMPRE con el toque del usuario (la app no actúa sola al abrirse).
 */
public final class NativeAction {
    // API portables a Android 8 (minSdk 26): nada de Set.of ni URLDecoder.decode(String, Charset).
    public static final Set<String> ALLOWED = Collections.unmodifiableSet(new HashSet<>(Arrays.asList("BLE_BEACON", "LOW_POWER_BEACON", "WIFI_SCAN")));
    public final Set<String> actions = new LinkedHashSet<>();
    public String beaconId, buildingId, cmdId;
    public Integer floor, battery;
    public Character unit;

    public static NativeAction parse(String uri) {
        URI u = URI.create(uri);
        if (!"senda".equals(u.getScheme()) || !"accion".equals(u.getHost())) throw new IllegalArgumentException("Enlace no es senda://accion");
        NativeAction a = new NativeAction();
        String q = u.getRawQuery() == null ? "" : u.getRawQuery();
        for (String kv : q.split("&")) {
            int i = kv.indexOf('='); if (i <= 0) continue;
            String k = kv.substring(0, i), v = decode(kv.substring(i + 1));
            switch (k) {
                case "a": for (String x : v.split(",")) { if (x.isEmpty()) continue; if (!ALLOWED.contains(x)) throw new IllegalArgumentException("Acción no permitida: " + x); a.actions.add(x); } break;
                case "id": if (!v.matches("[0-9a-f]{16}")) throw new IllegalArgumentException("id no válido"); a.beaconId = v; break;
                case "b": a.buildingId = v.isEmpty() ? null : v.substring(0, Math.min(32, v.length())); break;
                case "f": a.floor = v.matches("-?\\d{1,3}") ? Integer.valueOf(v) : null; break;
                case "u": a.unit = v.isEmpty() ? null : Character.toUpperCase(v.charAt(0)); break;
                case "bat": a.battery = v.matches("\\d{1,3}") ? Math.min(100, Integer.parseInt(v)) : null; break;
                case "cmd": a.cmdId = v.isEmpty() ? null : v.substring(0, Math.min(64, v.length())); break;
                default: break;
            }
        }
        if (a.beaconId == null) throw new IllegalArgumentException("Falta id de baliza");
        return a;
    }

    private static String decode(String v) {
        try { return URLDecoder.decode(v, "UTF-8"); } catch (UnsupportedEncodingException e) { throw new IllegalStateException(e); }
    }
}
