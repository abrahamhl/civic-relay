package eu.senda.field;

/**
 * Prueba en la JVM pura (sin Android) del traductor de direcciones de la app offline.
 * Ver .github/workflows/senda-android-ci.yml.
 */
public final class OfflineAssetsTest {
    private static int checks;
    private static void check(boolean ok, String why) { checks++; if (!ok) throw new AssertionError(why); }
    private static String path(String url) { OfflineAssets.Asset a = OfflineAssets.resolve(url); return a == null ? null : a.path; }
    private static String mime(String url) { OfflineAssets.Asset a = OfflineAssets.resolve(url); return a == null ? null : a.mime; }

    public static void main(String[] args) {
        String O = OfflineAssets.ORIGIN;
        // rutas de la app
        check("senda/index.html".equals(path(O + "/senda")), "/senda → índice");
        check("senda/index.html".equals(path(O + "/senda/")), "/senda/ → índice");
        check("senda/red.html".equals(path(O + "/senda/red")), "URL limpia → .html");
        check("senda/centro.html".equals(path(O + "/senda/centro?x=1#y")), "ignora consulta y fragmento");
        check("senda/core/envelope.mjs".equals(path(O + "/senda/core/envelope.mjs")), "módulo del núcleo");
        check("text/javascript".equals(mime(O + "/senda/core/envelope.mjs")), "MIME de módulo ES");
        check("application/json".equals(mime(O + "/senda/estado.json")), "MIME JSON");
        check("geo/land-110m.json".equals(path(O + "/geo/land-110m.json")), "mapa del mundo permitido");
        check("senda/data/a b.json".equals(path(O + "/senda/data/a%20b.json")), "decodifica %20");
        // la IA de la cámara y las fuentes deben servirse (antes daban 404 dentro de la app)
        check("application/wasm".equals(mime(O + "/senda/vendor/mediapipe-tasks-vision-1.2.3/wasm/vision_wasm_internal.wasm")), "MIME wasm");
        check("application/octet-stream".equals(mime(O + "/senda/vendor/models/efficientdet_lite0_int8.tflite")), "modelo tflite");
        check("font/woff2".equals(mime(O + "/senda/fonts/inter.woff2")), "fuente woff2");
        check("image/webp".equals(mime(O + "/senda/previews/conducir.webp")), "vista previa webp");
        // rechazos
        check(path("https://evil.example/senda/red") == null, "otro origen");
        check(path("http://app.senda.local/senda/red") == null, "HTTP sin cifrar");
        check(path(O + "/senda/../secret.txt") == null, "recorrido de directorios");
        check(path(O + "/senda/%2e%2e/x.json") == null, "recorrido codificado");
        check(path(O + "/senda/a%00.json") == null, "byte nulo");
        check(path(O + "/senda/a%zz.json") == null, "escape mal formado");
        check(path(O + "/senda//core/x.mjs") == null, "doble barra");
        check(path(O + "/etc/passwd") == null, "fuera de /senda");
        check(path(O + "/senda/app.exe") == null, "tipo no previsto");
        check(path(O + "/senda/x\\y.mjs") == null, "barra invertida");
        check(path(null) == null, "nulo");
        // navegación
        check(OfflineAssets.isInApp(O + "/senda/red"), "navegación interna");
        check(!OfflineAssets.isInApp("https://app.senda.local.evil.example/senda"), "subdominio engañoso");
        check(!OfflineAssets.isInApp("senda://accion?a=BLE_BEACON"), "enlace de radios no es navegación web");
        System.out.println("OfflineAssetsTest: " + checks + " comprobaciones correctas");
    }
}
