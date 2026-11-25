package eu.senda.field;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Servicios de Internet que la app web puede usar DENTRO de la app (versión play, con permiso INTERNET):
 * mapa, rutas, búsqueda y ortofotos oficiales. Todo lo demás sigue bloqueado (404).
 * En la versión base no hay permiso INTERNET: estas peticiones fallan solas y se usa el radar sin red.
 * Java puro: se prueba en la JVM (NetAllowTest).
 */
public final class NetAllow {
    private static final List<String> HOSTS = Arrays.asList(
        "tiles.openfreemap.org",          // mapa (OpenFreeMap, sin clave)
        "router.project-osrm.org",        // rutas en coche (OSRM de FOSSGIS, pruebas)
        "routing.openstreetmap.de",       // rutas a pie y en bici (FOSSGIS)
        "nominatim.openstreetmap.org",    // búsqueda (≤ 1 petición/s)
        "service.pdok.nl",                // ortofoto oficial de Países Bajos (PDOK, CC BY 4.0)
        "tms-pnoa-ma.idee.es"             // ortofoto oficial de España (PNOA, IGN, CC BY 4.0)
    );
    private NetAllow() {}

    public static boolean allowed(String url) {
        if (url == null) return false;
        try {
            URI x = new URI(url.trim());
            if (!"https".equals(x.getScheme()) || x.getHost() == null || x.getUserInfo() != null) return false;
            if (x.getPort() != -1 && x.getPort() != 443) return false;
            return HOSTS.contains(x.getHost().toLowerCase(Locale.ROOT));
        } catch (java.net.URISyntaxException e) { return false; }
    }
}
