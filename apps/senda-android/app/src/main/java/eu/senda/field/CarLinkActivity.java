package eu.senda.field;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothDevice;
import android.companion.AssociationInfo;
import android.companion.AssociationRequest;
import android.companion.BluetoothDeviceFilter;
import android.companion.CompanionDeviceManager;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageManager;
import android.net.MacAddress;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * SENDA Drive: consentimiento expreso y vinculación del coche. Nada se activa sin pulsar aquí; todo se
 * puede desactivar aquí mismo. Se guarda solo la dirección Bluetooth del coche, en el móvil.
 */
public final class CarLinkActivity extends Activity {
    private static final int REQ_ASSOC = 51, REQ_PERMS = 52, REQ_BG = 53, REQ_AR = 54;
    private TextView status;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        col.setPadding(pad, pad, pad, pad);
        text(col, "SENDA Drive", 22);
        text(col, "Si lo activas, SENDA se pone en marcha sola cuando subes a TU coche (al conectar su Bluetooth) y se apaga cuando te bajas. "
                + "Mientras tanto verás una notificación fija con el botón «Parar». Solo se guarda en este móvil la dirección Bluetooth del coche; "
                + "la app no envía nada por Internet. Puedes desactivarlo cuando quieras.", 15);
        text(col, "Umbrales de arranque y parada: valores de ejemplo, aún sin calibrar con trayectos reales.", 13);
        button(col, "Vincular mi coche y activar el arranque automático", v -> askPermissionsThenLink());
        if (VehicleHints.available()) button(col, "Detectar también que voy en un vehículo (Google)", v -> askActivityRecognition());
        button(col, "Permitir ubicación «siempre» (para leer la velocidad cuando SENDA se activa sola)", v -> askBackgroundLocation());
        button(col, "Empezar ahora", v -> { DriveController.get(this).event("USER_START"); refresh(); });
        button(col, "Parar ahora", v -> { DriveController.get(this).event("USER_STOP"); refresh(); });
        button(col, "Desactivar el arranque automático", v -> disable());
        status = text(col, "", 14);
        ScrollView sv = new ScrollView(this);
        sv.addView(col);
        setContentView(sv);
        refresh();
    }

    private TextView text(LinearLayout col, String s, int sp) { TextView t = new TextView(this); t.setText(s); t.setTextSize(sp); t.setPadding(0, 12, 0, 12); col.addView(t); return t; }
    private void button(LinearLayout col, String s, android.view.View.OnClickListener l) { Button bt = new Button(this); bt.setText(s); bt.setOnClickListener(l); col.addView(bt, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)); }

    private void refresh() {
        DriveController c = DriveController.get(this);
        status.setText("Arranque automático: " + (c.autoStartConsented() ? "ACTIVADO" : "desactivado")
                + "\nCoche vinculado: " + (c.carAddress() == null ? "ninguno" : c.carAddress())
                + "\nEstado: " + c.state() + (c.sessionActive() ? " (en ruta)" : ""));
    }

    private boolean granted(String p) { return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }

    private void askPermissionsThenLink() {
        List<String> need = new ArrayList<>();
        if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need.add(Manifest.permission.POST_NOTIFICATIONS);
        if (Build.VERSION.SDK_INT >= 31 && !granted(Manifest.permission.BLUETOOTH_CONNECT)) need.add(Manifest.permission.BLUETOOTH_CONNECT);
        if (need.isEmpty()) link(); else requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == REQ_PERMS) {
            if (granted(Manifest.permission.ACCESS_FINE_LOCATION)) link();
            else status.setText("Sin ubicación precisa SENDA Drive no puede funcionar. No se ha activado nada.");
        } else if (req == REQ_AR) {
            if (Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACTIVITY_RECOGNITION)) enableHints();
            else status.setText("Sin permiso de actividad física no se usa la detección de vehículo.");
        }
        refresh();
    }

    private void link() {
        CompanionDeviceManager cdm = getSystemService(CompanionDeviceManager.class);
        AssociationRequest req = new AssociationRequest.Builder().addDeviceFilter(new BluetoothDeviceFilter.Builder().build()).setSingleDevice(false).build();
        cdm.associate(req, new CompanionDeviceManager.Callback() {
            @SuppressWarnings("deprecation") @Override public void onDeviceFound(IntentSender chooser) { launch(chooser); }
            @Override public void onAssociationPending(IntentSender chooser) { launch(chooser); }
            @Override public void onAssociationCreated(AssociationInfo info) { MacAddress m = info.getDeviceMacAddress(); if (m != null) linked(m.toString()); }
            @Override public void onFailure(CharSequence error) { status.setText("No se pudo vincular: " + error); }
        }, null);
    }

    private void launch(IntentSender chooser) {
        try { startIntentSenderForResult(chooser, REQ_ASSOC, null, 0, 0, 0); }
        catch (IntentSender.SendIntentException e) { status.setText("No se pudo abrir la lista de dispositivos."); }
    }

    @SuppressWarnings("deprecation")
    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_ASSOC || res != RESULT_OK || data == null) return;
        String address = null;
        if (Build.VERSION.SDK_INT >= 33) {
            AssociationInfo info = data.getParcelableExtra(CompanionDeviceManager.EXTRA_ASSOCIATION, AssociationInfo.class);
            if (info != null && info.getDeviceMacAddress() != null) address = info.getDeviceMacAddress().toString();
        } else {
            BluetoothDevice d = data.getParcelableExtra(CompanionDeviceManager.EXTRA_DEVICE);
            if (d != null) address = d.getAddress();
        }
        if (address != null) linked(address);
    }

    private void linked(String address) {
        DriveController.get(this).setConsent(true, address);
        if (Build.VERSION.SDK_INT >= 31) {
            try { getSystemService(CompanionDeviceManager.class).startObservingDevicePresence(address); }
            catch (Exception e) { status.setText("Vinculado, pero el sistema no permite observar su presencia: " + e.getMessage()); }
        }
        refresh();
    }

    private void askBackgroundLocation() {
        if (Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) requestPermissions(new String[] { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, REQ_BG);
    }

    private void askActivityRecognition() {
        if (Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACTIVITY_RECOGNITION)) requestPermissions(new String[] { Manifest.permission.ACTIVITY_RECOGNITION }, REQ_AR);
        else enableHints();
    }

    private void enableHints() {
        try { VehicleHints.register(this); DriveController.get(this).setConsent(true, null); status.setText("Detección de vehículo activada."); }
        catch (RuntimeException e) { status.setText("No se pudo activar la detección de vehículo: " + e.getMessage()); }
    }

    private void disable() {
        DriveController c = DriveController.get(this);
        String address = c.carAddress();
        if (Build.VERSION.SDK_INT >= 31 && address != null) {
            try { getSystemService(CompanionDeviceManager.class).stopObservingDevicePresence(address); } catch (Exception ignored) { }
        }
        VehicleHints.unregister(this);
        c.setConsent(false, null);
        refresh();
    }
}
