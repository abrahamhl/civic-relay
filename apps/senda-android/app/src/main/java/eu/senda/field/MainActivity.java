package eu.senda.field;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/**
 * SENDA Android (compañero nativo de la app web SENDA Campo).
 * Hace lo que un navegador no puede: baliza BLE, escucha de balizas y barrido Wi-Fi.
 * Se abre desde una alerta firmada de la web (senda://accion?…) o a mano. Nunca actúa
 * sin un toque del usuario: Android no permite encender radios en segundo plano y SENDA
 * tampoco lo intenta.
 */
public final class MainActivity extends Activity {
    private static final int REQ_PERMS = 7;
    private BleBeacon beacon;
    private WifiSurveyRecorder wifi;
    private TextView status, pending;
    private EditText idField, xField, yField, floorField, unitField;
    private NativeAction action;
    private Runnable afterPerms;
    private int seq;
    private File surveyFile;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        beacon = new BleBeacon(this);
        wifi = new WifiSurveyRecorder(this);
        surveyFile = new File(getFilesDir(), "barrido.jsonl");
        setContentView(buildUi());
        handle(getIntent());
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); handle(i); }

    @Override protected void onDestroy() { beacon.stop(); wifi.release(); super.onDestroy(); }

    private void handle(Intent i) {
        Uri u = i == null ? null : i.getData();
        if (u == null) return;
        try {
            action = NativeAction.parse(u.toString());
            idField.setText(action.beaconId);
            if (action.floor != null) floorField.setText(String.valueOf(action.floor));
            if (action.unit != null) unitField.setText(String.valueOf(action.unit));
            pending.setText("La alerta verificada en SENDA pide: " + String.join(", ", action.actions) + (action.buildingId != null ? " · edificio " + action.buildingId : "") + "\nPulsa «Activar lo que pide la alerta».");
            pending.setVisibility(View.VISIBLE);
        } catch (IllegalArgumentException e) {
            say("Enlace rechazado: " + e.getMessage());
        }
    }

    /* ---------------- acciones ---------------- */
    private void runAlertActions() {
        if (action == null) { say("No hay alerta pendiente"); return; }
        if (action.actions.contains("BLE_BEACON") || action.actions.contains("LOW_POWER_BEACON")) startBeacon(action.actions.contains("LOW_POWER_BEACON") || batteryPct() <= 15, "TRAPPED");
        if (action.actions.contains("WIFI_SCAN")) scanWifi();
    }

    private void startBeacon(boolean lowPower, String st) {
        withPerms(blePerms(true), () -> {
            String id = idField.getText().toString().trim();
            if (!id.matches("[0-9a-f]{16}")) { say("Id de baliza: 16 caracteres hex (te lo da la web en Zona › Mi edificio)"); return; }
            Integer floor = parseInt(floorField);
            String u = unitField.getText().toString().trim();
            byte[] frame = SendaFormats.encodeFrame(st, batteryPct(), floor, u.isEmpty() ? null : Character.toUpperCase(u.charAt(0)), id, seq++ & 0xFFFF);
            if (!beacon.radioOn()) { askBluetoothOn(); return; }
            beacon.start(frame, lowPower, this::say);
        });
    }

    private void scanWifi() {
        withPerms(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, () -> {
            Integer floor = parseInt(floorField);
            Double x = parseDouble(xField), y = parseDouble(yField);
            if (floor == null || x == null || y == null) { say("Indica x, y (metros desde la esquina) y planta"); return; }
            wifi.setPosition(x, y, SendaFormats.zFor(floor, 1.2));
            wifi.scanHere((lines, summary) -> runOnUiThread(() -> { append(lines); say(summary + " · total " + countLines()); }));
        });
    }

    private void listenBeacons() {
        withPerms(blePerms(false), () -> {
            Integer floor = parseInt(floorField);
            Double x = parseDouble(xField), y = parseDouble(yField);
            if (floor == null || x == null || y == null) { say("Indica x, y y planta de donde escuchas"); return; }
            if (!beacon.radioOn()) { askBluetoothOn(); return; }
            final double z = SendaFormats.zFor(floor, 1.2);
            beacon.listen(10_000, (fr, rssi) -> runOnUiThread(() -> {
                List<String> l = new ArrayList<>();
                l.add(SendaFormats.surveyLine(x, y, z, "ble:" + fr.beaconId, fr.status + (fr.floor != null ? " P" + fr.floor : "") + (fr.unit != null ? fr.unit : ""), Math.max(-127, Math.min(0, rssi)), System.currentTimeMillis() / 1000L, false, false, "android-ble"));
                append(l);
                say("Baliza " + fr.beaconId.substring(0, 6) + "… " + fr.status + (fr.battery != null ? " · batería " + fr.battery + " %" : "") + " · " + rssi + " dBm");
            }), this::say);
        });
    }

    private void shareSurvey() {
        String text = readSurvey();
        if (text.isEmpty()) { say("Barrido vacío"); return; }
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("SENDA barrido", text));
        Intent s = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text).putExtra(Intent.EXTRA_SUBJECT, "SENDA barrido.jsonl");
        startActivity(Intent.createChooser(s, "Enviar barrido (también copiado)"));
    }

    /* ---------------- permisos (siempre con toque del usuario) ---------------- */
    private String[] blePerms(boolean advertise) {
        if (Build.VERSION.SDK_INT >= 31) return advertise
                ? new String[]{Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT}
                : new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION};
        return new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
    }

    private void withPerms(String[] perms, Runnable then) {
        List<String> missing = new ArrayList<>();
        for (String p : perms) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        if (missing.isEmpty()) { then.run(); return; }
        afterPerms = then;
        requestPermissions(missing.toArray(new String[0]), REQ_PERMS);
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != REQ_PERMS) return;
        for (int r : res) if (r != PackageManager.PERMISSION_GRANTED) { say("Permiso denegado: SENDA no puede hacerlo sin él"); afterPerms = null; return; }
        Runnable r = afterPerms; afterPerms = null; if (r != null) r.run();
    }

    private void askBluetoothOn() {
        say("Bluetooth apagado: Android pide tu confirmación para encenderlo y vuelve a pulsar");
        try { startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)); } catch (SecurityException e) { say("Activa Bluetooth en Ajustes rápidos"); }
    }

    /* ---------------- utilidades ---------------- */
    private int batteryPct() {
        BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
        int v = bm == null ? -1 : bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        return v < 0 || v > 100 ? 100 : v;
    }

    private void append(List<String> lines) {
        if (lines.isEmpty()) return;
        try (FileOutputStream o = new FileOutputStream(surveyFile, true)) {
            for (String l : lines) o.write((l + "\n").getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) { say("No se pudo guardar: " + e.getMessage()); }
    }

    private String readSurvey() {
        try { return surveyFile.exists() ? new String(Files.readAllBytes(surveyFile.toPath()), StandardCharsets.UTF_8) : ""; }
        catch (IOException e) { return ""; }
    }

    private int countLines() { String s = readSurvey(); return s.isEmpty() ? 0 : s.split("\n").length; }

    private static Integer parseInt(EditText e) { try { return Integer.valueOf(e.getText().toString().trim()); } catch (NumberFormatException x) { return null; } }
    private static Double parseDouble(EditText e) { try { return Double.valueOf(e.getText().toString().trim().replace(',', '.')); } catch (NumberFormatException x) { return null; } }

    private void say(String t) { runOnUiThread(() -> status.setText(t)); }

    /* ---------------- interfaz (sin XML ni dependencias) ---------------- */
    private View buildUi() {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        col.setPadding(pad, pad, pad, pad);
        TextView h = new TextView(this); h.setText("SENDA Android · baliza y barrido"); h.setTextSize(22); col.addView(h);
        TextView lead = new TextView(this);
        lead.setText("Complemento de la app web SENDA Campo para lo que el navegador no permite: emitir tu baliza Bluetooth, escuchar balizas de personas atrapadas y barrer routers Wi-Fi por planta. Nada se activa sin tu toque.");
        col.addView(lead);
        pending = new TextView(this); pending.setVisibility(View.GONE); pending.setTextSize(16); col.addView(pending);
        col.addView(button("Activar lo que pide la alerta", v -> runAlertActions()));
        idField = field(col, "Id de baliza (16 hex, de la web)", InputType.TYPE_CLASS_TEXT);
        floorField = field(col, "Planta", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_SIGNED);
        unitField = field(col, "Puerta (A, B, C…)", InputType.TYPE_CLASS_TEXT);
        col.addView(button("Emitir baliza: ESTOY ATRAPADO", v -> startBeacon(batteryPct() <= 15, "TRAPPED")));
        col.addView(button("Emitir baliza: estoy bien", v -> startBeacon(true, "SAFE")));
        col.addView(button("Parar baliza", v -> { beacon.stop(); say("Baliza parada"); }));
        TextView sv = new TextView(this); sv.setText("\nBarrido (rescatador o vecino): colócate en un punto, indica dónde estás y pulsa."); col.addView(sv);
        xField = field(col, "x (m desde la esquina SO)", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        yField = field(col, "y (m desde la esquina SO)", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        col.addView(button("Barrer Wi-Fi aquí", v -> scanWifi()));
        col.addView(button("Escuchar balizas aquí (10 s)", v -> listenBeacons()));
        col.addView(button("Enviar barrido a la web (JSONL)", v -> shareSurvey()));
        col.addView(button("Vaciar barrido", v -> { if (surveyFile.delete()) say("Barrido vaciado"); }));
        status = new TextView(this); status.setTextSize(16); status.setPadding(0, pad, 0, 0); col.addView(status);
        ScrollView s = new ScrollView(this); s.addView(col); return s;
    }

    private Button button(String text, View.OnClickListener l) { Button b = new Button(this); b.setText(text); b.setOnClickListener(l); return b; }

    private EditText field(LinearLayout col, String hint, int type) { EditText e = new EditText(this); e.setHint(hint); e.setInputType(type); col.addView(e); return e; }
}
