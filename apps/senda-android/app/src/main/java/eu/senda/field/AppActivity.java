package eu.senda.field;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * SENDA como aplicación: la app web completa (la misma que pasa las pruebas del núcleo) va DENTRO del APK
 * y se sirve desde assets/ con un origen HTTPS propio (OfflineAssets). No hace falta navegador, ni
 * conexión en el primer arranque, ni permiso de Internet: la app no puede hablar con ningún servidor.
 *
 * Lo que la web no puede hacer (baliza BLE, escucha de balizas, barrido Wi-Fi) lo hace la pantalla
 * nativa de radios (MainActivity). El puente solo permite ABRIRLA con una acción validada; encender
 * cualquier radio sigue exigiendo el toque del usuario allí.
 */
public final class AppActivity extends Activity {
    private WebView web;
    private static final int REQ_MIC = 41, REQ_GEO = 42;
    private PermissionRequest pendingMic;
    private GeolocationPermissions.Callback pendingGeo;
    private String pendingGeoOrigin;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);          // la app es JavaScript (módulos ES del núcleo)
        s.setDomStorageEnabled(true);          // IndexedDB / localStorage: buzón y reserva offline
        s.setAllowFileAccess(false);           // sin file://
        s.setAllowContentAccess(false);        // sin content://
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setGeolocationEnabled(true);         // «Usar mi posición» en avisos: solo con permiso del usuario
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.addJavascriptInterface(new Bridge(), "SendaNative");
        setContentView(web);
        if (b != null) web.restoreState(b); else web.loadUrl(OfflineAssets.START);
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    private boolean openRadios(String uri) {
        try {
            NativeAction.parse(uri); // misma validación que un enlace senda:// llegado de fuera
        } catch (IllegalArgumentException e) {
            return false;
        }
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), this, MainActivity.class);
        runOnUiThread(() -> startActivity(i));
        return true;
    }

    /**
     * Permisos del visor: solo para páginas de la propia app y solo tras el diálogo de Android.
     * Micrófono: lo usa «Escuchar por sonido» (módem acústico). Ubicación: «Usar mi posición».
     */
    private final class Chrome extends WebChromeClient {
        @Override public void onPermissionRequest(PermissionRequest req) {
            boolean onlyAudio = req.getResources().length == 1 && PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(req.getResources()[0]);
            if (!onlyAudio || !OfflineAssets.isInApp(req.getOrigin().toString())) { req.deny(); return; }
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { req.grant(req.getResources()); return; }
            pendingMic = req;
            requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, REQ_MIC);
        }

        @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            if (!OfflineAssets.isInApp(origin)) { cb.invoke(origin, false, false); return; }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) { cb.invoke(origin, true, false); return; }
            pendingGeo = cb; pendingGeoOrigin = origin;
            requestPermissions(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, REQ_GEO);
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_MIC && pendingMic != null) { if (ok) pendingMic.grant(pendingMic.getResources()); else pendingMic.deny(); pendingMic = null; }
        if (code == REQ_GEO && pendingGeo != null) { pendingGeo.invoke(pendingGeoOrigin, ok, false); pendingGeo = null; pendingGeoOrigin = null; }
    }

    private final class Client extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            OfflineAssets.Asset a = OfflineAssets.resolve(req.getUrl().toString());
            if (a == null) return notFound();
            try {
                InputStream in = getAssets().open(a.path);
                String enc = a.mime.startsWith("text/") || a.mime.contains("json") || a.mime.contains("javascript") || a.mime.contains("svg") ? "utf-8" : null;
                return new WebResourceResponse(a.mime, enc, in);
            } catch (IOException e) {
                return notFound();
            }
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            String url = req.getUrl().toString();
            if (url.startsWith("senda://")) { openRadios(url); return true; }
            return !OfflineAssets.isInApp(url); // cualquier otro destino se bloquea: la app no navega fuera
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", Collections.emptyMap(),
                new ByteArrayInputStream("no encontrado".getBytes(StandardCharsets.UTF_8)));
        }
    }

    /** Puente mínimo hacia lo nativo. Cada método es un permiso: añadir solo lo imprescindible. */
    private final class Bridge {
        @JavascriptInterface public String info() {
            return "{\"app\":\"SENDA Android\",\"native\":true,\"offlineAssets\":true,\"radios\":[\"BLE_BEACON\",\"LOW_POWER_BEACON\",\"WIFI_SCAN\"]}";
        }

        /** Abre la pantalla de radios con una acción senda://accion?… validada; el usuario confirma allí. */
        @JavascriptInterface public boolean openRadios(String uri) { return AppActivity.this.openRadios(uri); }
    }
}
