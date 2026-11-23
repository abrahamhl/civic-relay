package eu.senda.field;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import android.view.WindowInsets;
import android.widget.FrameLayout;
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
    private static final int REQ_MIC = 41, REQ_GEO = 42, REQ_VOICE = 43, REQ_CAM = 44, REQ_BT = 45;
    private BleMailbox mailbox;
    private Runnable afterBt;
    private PermissionRequest pendingCam;
    private SpeechRecognizer recognizer;
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
        // Android 15 dibuja de borde a borde: sin esto la web queda bajo la hora y los botones del sistema.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 9, 12));
        web.setBackgroundColor(Color.rgb(5, 9, 12));
        root.addView(web);
        if (android.os.Build.VERSION.SDK_INT >= 35) root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsets.CONSUMED;
        });
        setContentView(root);
        if (b != null) web.restoreState(b); else web.loadUrl(OfflineAssets.START);
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    @Override protected void onDestroy() { if (recognizer != null) recognizer.destroy(); if (mailbox != null) mailbox.stop(); web.destroy(); super.onDestroy(); }

    // ── Buzón Bluetooth cercano (móvil a móvil, también en modo avión con el Bluetooth encendido) ──
    private String[] btPerms() {
        return Build.VERSION.SDK_INT >= 31
                ? new String[] { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE }
                : new String[] { Manifest.permission.ACCESS_FINE_LOCATION };
    }
    private void withBt(Runnable r) {
        for (String p : btPerms()) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) { afterBt = r; requestPermissions(btPerms(), REQ_BT); return; }
        r.run();
    }
    private BleMailbox mailbox() {
        if (mailbox == null) mailbox = new BleMailbox(this, new BleMailbox.Listener() {
            @Override public void received(byte[] msg, String from) {
                try { p2pPost(new JSONObject().put("event", "received").put("b64", android.util.Base64.encodeToString(msg, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP | android.util.Base64.NO_PADDING))); }
                catch (org.json.JSONException ignored) { }
            }
            @Override public void status(String text) { p2pEvent("status", text); }
        });
        return mailbox;
    }
    private void p2pEvent(String ev, String text) { try { p2pPost(new JSONObject().put("event", ev).put("text", text)); } catch (org.json.JSONException ignored) { } }
    private void p2pPost(JSONObject o) { web.post(() -> web.evaluateJavascript("window.sendaP2P&&window.sendaP2P(" + o + ")", null)); }

    // ── Aviso por voz: reconocimiento del propio Android, en español y prefiriendo el modo sin red. ──
    // Sin red solo funciona si el móvil tiene descargado el paquete de idioma; si no, el sistema devuelve error.
    private void startVoice() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { voiceResult(err("NO_DISPONIBLE")); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, REQ_VOICE); return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onResults(Bundle r) {
                    ArrayList<String> list = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    try { voiceResult(new JSONObject().put("alternatives", new JSONArray(list == null ? new ArrayList<String>() : list))); }
                    catch (org.json.JSONException e) { voiceResult(err("JSON")); }
                }
                @Override public void onError(int code) { voiceResult(err("ERROR_" + code)); }
                @Override public void onReadyForSpeech(Bundle p) { voiceResult(state("ESCUCHANDO")); }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float v) {}
                @Override public void onBufferReceived(byte[] b) {}
                @Override public void onEndOfSpeech() { voiceResult(state("PROCESANDO")); }
                @Override public void onPartialResults(Bundle p) {}
                @Override public void onEvent(int t, Bundle p) {}
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        recognizer.startListening(i);
    }
    private static JSONObject err(String code) { try { return new JSONObject().put("error", code); } catch (org.json.JSONException e) { return new JSONObject(); } }
    private static JSONObject state(String s) { try { return new JSONObject().put("state", s); } catch (org.json.JSONException e) { return new JSONObject(); } }
    private void voiceResult(JSONObject o) { web.post(() -> web.evaluateJavascript("window.sendaVoice&&window.sendaVoice(" + o + ")", null)); }

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
     * Micrófono: lo usa «Escuchar por sonido» (módem acústico). Cámara: leer el QR de acceso. Ubicación: «Usar mi posición».
     */
    private final class Chrome extends WebChromeClient {
        @Override public void onPermissionRequest(PermissionRequest req) {
            boolean single = req.getResources().length == 1;
            boolean onlyAudio = single && PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(req.getResources()[0]);
            boolean onlyVideo = single && PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(req.getResources()[0]);
            if (!(onlyAudio || onlyVideo) || !OfflineAssets.isInApp(req.getOrigin().toString())) { req.deny(); return; }
            if (onlyVideo) { // cámara: solo para leer el QR de acceso en Ajustes
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) { req.grant(req.getResources()); return; }
                pendingCam = req;
                requestPermissions(new String[] { Manifest.permission.CAMERA }, REQ_CAM);
                return;
            }
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
        if (code == REQ_VOICE) { if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoice(); else voiceResult(err("PERMISO_DENEGADO")); return; }
        if (code == REQ_BT) {
            boolean all = results.length > 0; for (int r : results) all &= r == PackageManager.PERMISSION_GRANTED;
            if (all && afterBt != null) afterBt.run(); else p2pEvent("status", "Sin permiso de Bluetooth: no se puede usar el buzón cercano");
            afterBt = null; return;
        }
        if (code == REQ_CAM && pendingCam != null) { if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingCam.grant(pendingCam.getResources()); else pendingCam.deny(); pendingCam = null; return; }
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
            return "{\"app\":\"SENDA Android\",\"native\":true,\"offlineAssets\":true,\"radios\":[\"BLE_BEACON\",\"LOW_POWER_BEACON\",\"WIFI_SCAN\"],\"drive\":true,\"voice\":true,\"p2p\":\"BLE_GATT\"}";
        }

        /** Abre la pantalla de radios con una acción senda://accion?… validada; el usuario confirma allí. */
        @JavascriptInterface public boolean openRadios(String uri) { return AppActivity.this.openRadios(uri); }

        /** Abre SENDA Drive (consentimiento y vínculo del coche). Ya no es un icono aparte: se entra desde la app. */
        /** Abre el buzón Bluetooth cercano (pide permisos la primera vez). */
        @JavascriptInterface public void p2pStart() { runOnUiThread(() -> withBt(() -> mailbox().start())); }

        /** Entrega un sobre (base64url) a los móviles SENDA cercanos con el buzón abierto. */
        @JavascriptInterface public boolean p2pSend(String b64) {
            final byte[] bytes;
            try { bytes = android.util.Base64.decode(b64, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP | android.util.Base64.NO_PADDING); }
            catch (IllegalArgumentException e) { return false; }
            if (bytes.length == 0 || bytes.length > MailboxFrames.MAX_BYTES) return false;
            runOnUiThread(() -> withBt(() -> mailbox().send(bytes, 8000)));
            return true;
        }

        @JavascriptInterface public void listen() { runOnUiThread(AppActivity.this::startVoice); }

        @JavascriptInterface public boolean openDrive() {
            runOnUiThread(() -> startActivity(new Intent(AppActivity.this, CarLinkActivity.class)));
            return true;
        }
    }
}
