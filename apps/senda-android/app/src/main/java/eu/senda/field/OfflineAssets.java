package eu.senda.field;

import java.util.Locale;

/**
 * Traduce las direcciones que pide la app web (servida dentro del APK) a ficheros de assets/.
 * Java puro, sin Android: se prueba en la JVM (OfflineAssetsTest) y lo usa AppActivity.
 *
 * Origen único: https://app.senda.local (HTTPS para que WebCrypto y los módulos ES funcionen como
 * en la web). Nada sale a la red: cualquier otro origen, ruta fuera de las permitidas o intento de
 * recorrer directorios se rechaza (devuelve null) y el WebView recibe un 404.
 */
public final class OfflineAssets {
    public static final String ORIGIN = "https://app.senda.local";
    public static final String START = ORIGIN + "/senda";

    private OfflineAssets() {}

    /** Resultado: ruta dentro de assets/ y tipo MIME. */
    public static final class Asset {
        public final String path, mime;
        Asset(String path, String mime) { this.path = path; this.mime = mime; }
    }

    /** null si la URL no es de la app o no está permitida. */
    public static Asset resolve(String url) {
        if (url == null || !url.startsWith(ORIGIN + "/")) return null;
        String p = url.substring(ORIGIN.length());
        int cut = indexOfAny(p, '?', '#');
        if (cut >= 0) p = p.substring(0, cut);
        p = percentDecodeStrict(p);
        if (p == null || p.contains("\\") || p.contains("//") || p.contains("\0")) return null;
        for (String seg : p.split("/")) if (seg.equals("..") || seg.equals(".")) return null;
        if (p.equals("/senda") || p.equals("/senda/")) p = "/senda/index.html";
        boolean allowed = p.startsWith("/senda/") || p.equals("/geo/land-110m.json");
        if (!allowed) return null;
        String file = p.substring(1);
        String last = file.substring(file.lastIndexOf('/') + 1);
        if (!last.contains(".")) file = file + ".html"; // URL limpias de la web: /senda/red → senda/red.html
        String mime = mimeOf(file);
        return mime == null ? null : new Asset(file, mime);
    }

    /** Solo se navega dentro de la app; los enlaces senda:// los atiende la pantalla de radios. */
    public static boolean isInApp(String url) { return url != null && (url.equals(ORIGIN) || url.startsWith(ORIGIN + "/")); }

    static String mimeOf(String file) {
        String ext = file.substring(file.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html";
            case "mjs": case "js": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "bin": return "application/octet-stream";
            case "txt": case "md": return "text/plain";
            default: return null; // tipo no previsto: no se sirve
        }
    }

    private static int indexOfAny(String s, char a, char b) {
        int i = s.indexOf(a), j = s.indexOf(b);
        return i < 0 ? j : j < 0 ? i : Math.min(i, j);
    }

    /** Decodifica %XX y rechaza secuencias mal formadas o caracteres de control. */
    static String percentDecodeStrict(String s) {
        if (s.indexOf('%') < 0) return s;
        StringBuilder out = new StringBuilder(s.length());
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        for (int i = 0; i < s.length(); ) {
            char c = s.charAt(i);
            if (c == '%') {
                bytes.reset();
                while (i < s.length() && s.charAt(i) == '%') {
                    if (i + 2 >= s.length()) return null;
                    int hi = Character.digit(s.charAt(i + 1), 16), lo = Character.digit(s.charAt(i + 2), 16);
                    if (hi < 0 || lo < 0) return null;
                    int v = hi * 16 + lo;
                    if (v < 0x20 || v == 0x7f) return null;
                    bytes.write(v); i += 3;
                }
                out.append(new String(bytes.toByteArray(), java.nio.charset.StandardCharsets.UTF_8));
            } else { out.append(c); i++; }
        }
        return out.toString();
    }
}
