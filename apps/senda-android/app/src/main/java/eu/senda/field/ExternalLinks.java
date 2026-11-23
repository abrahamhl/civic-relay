package eu.senda.field;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

/** Enlaces que la app abre FUERA (en su propia app): navegación y comunicación. Todo lo demás se bloquea. Java puro: se prueba en la JVM. */
public final class ExternalLinks {
    private static final List<String> HOSTS = Arrays.asList("waze.com", "www.waze.com", "maps.google.com", "www.google.com", "github.com");
    private ExternalLinks() {}

    public static boolean allowed(String url) {
        if (url == null) return false;
        String u = url.trim();
        if (u.startsWith("sms:") || u.startsWith("smsto:") || u.startsWith("tel:")) return true;
        try {
            URI x = new URI(u);
            if (!"https".equals(x.getScheme()) || x.getHost() == null || x.getUserInfo() != null || x.getPort() != -1) return false;
            String h = x.getHost().toLowerCase(java.util.Locale.ROOT);
            if (!HOSTS.contains(h)) return false;
            if (h.equals("www.google.com")) return x.getPath() != null && x.getPath().startsWith("/maps");
            if (h.equals("github.com")) return x.getPath() != null && x.getPath().startsWith("/abrahamhl/civic-relay/releases");
            return true;
        } catch (java.net.URISyntaxException e) { return false; }
    }
}
