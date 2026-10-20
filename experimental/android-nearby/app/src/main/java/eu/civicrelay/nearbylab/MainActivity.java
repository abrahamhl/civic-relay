package eu.civicrelay.nearbylab;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Experimental two-phone link only. Not an emergency service, satellite app, nor a 112 integration.
 * Explicit app consent + Android permissions + matching-code confirmation required.
 * Only synthetic messages are allowed; ephemeral in-memory state (no location collection).
 */
public final class MainActivity extends Activity {
    private static final String SERVICE_ID = "eu.civicrelay.nearbylab";
    private static final Strategy STRATEGY = Strategy.P2P_POINT_TO_POINT;
    private static final int REQUEST_PERMISSIONS = 6001;
    private static final int MAX_BYTES = 4096;
    private static final long TTL_MILLIS = 60000L;
    private ConnectionsClient connections;
    private TextView output;
    private boolean userConsented = false;
    private boolean connected = false;
    private String connectedPeer = null;
    private String lastSentId = null;
    private String waitingRole = null;
    private final Set<String> seenIds = new LinkedHashSet<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        connections = Nearby.getConnectionsClient(this);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(25, 30, 25, 30);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(body);
        setContentView(scroll);
        TextView heading = new TextView(this);
        heading.setText("CIVIC RELAY — TWO PHONE EXPERIMENT\nNO REAL SOS • NO 112 • NO LOCATION");
        heading.setTextSize(19);
        body.addView(heading);
        addButton(body, "1. I CONSENT TO THE EXPERIMENT", () -> {
            userConsented = true;
            log("Consent enabled for this session only.");
        });
        addButton(body, "2A. ADVERTISE AS LAB RECEIVER", () -> startRole("ADVERTISE"));
        addButton(body, "2B. DISCOVER AS LAB SENDER", () -> startRole("DISCOVER"));
        addButton(body, "3. SEND SYNTHETIC TEST MESSAGE", this::sendTest);
        addButton(body, "OPEN BLUETOOTH SETTINGS", () -> startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));
        addButton(body, "OPEN WI-FI SETTINGS", () -> startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS)));
        addButton(body, "STOP / REVOKE CONSENT / CLEAR", this::stopAndClear);
        output = new TextView(this);
        output.setTextSize(15);
        output.setPadding(0, 24, 0, 15);
        body.addView(output);
        log("Permissioned lab. Manually turn on radios if disabled; no hidden toggles. " +
            "Keep both apps foregrounded. Confirm the same pairing digits on BOTH phones.");
    }

    private void addButton(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        parent.addView(button);
        button.setOnClickListener(v -> action.run());
    }

    private void log(String note) {
        runOnUiThread(() -> {
            if (output != null) output.setText(note + "\n" + output.getText());
        });
    }

    private String[] runtimePermissions() {
        List<String> required = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            required.add(Manifest.permission.BLUETOOTH_ADVERTISE);
            required.add(Manifest.permission.BLUETOOTH_SCAN);
            required.add(Manifest.permission.BLUETOOTH_CONNECT);
            if (Build.VERSION.SDK_INT >= 32) required.add("android.permission.NEARBY_WIFI_DEVICES");
        } else if (Build.VERSION.SDK_INT >= 29) {
            required.add(Manifest.permission.ACCESS_FINE_LOCATION);
        } else {
            required.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        List<String> missing = new ArrayList<>();
        for (String p : required) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        }
        return missing.toArray(new String[0]);
    }

    private void startRole(String role) {
        if (!userConsented) {
            log("DENIED: opt in with button 1 first."); return;
        }
        String[] missing = runtimePermissions();
        if (missing.length > 0) {
            waitingRole = role;
            requestPermissions(missing, REQUEST_PERMISSIONS);
            return;
        }
        if ("ADVERTISE".equals(role)) advertise(); else discover();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode != REQUEST_PERMISSIONS) return;
        String role = waitingRole;
        waitingRole = null;
        if (!userConsented || runtimePermissions().length != 0 || role == null) {
            log("Required OS permissions missing; radio discovery not started.");return;
        }
        startRole(role);
    }

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override public void onConnectionInitiated(String endpointId, ConnectionInfo info) {
            runOnUiThread(() -> {
                if (!userConsented) { connections.rejectConnection(endpointId);return; }
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("VERIFY PEER / LAB ONLY")
                    .setMessage("Compare these digits on BOTH devices: " +
                        info.getAuthenticationDigits() +
                        "\nDo not accept unless they match. No identity is implied.")
                    .setPositiveButton("Codes match", (dialog, which) -> {
                        if (userConsented) connections.acceptConnection(endpointId, payloads)
                            .addOnFailureListener(e -> log("Accept failed: " + e.getClass().getSimpleName()));
                    })
                    .setNegativeButton("Reject", (dialog, which) -> connections.rejectConnection(endpointId))
                    .setCancelable(false)
                    .show();
            });
        }
        @Override public void onConnectionResult(String endpointId, ConnectionResolution result) {
            if (result.getStatus().getStatusCode() == ConnectionsStatusCodes.STATUS_OK && userConsented) {
                connected = true;
                connectedPeer = endpointId;
                connections.stopAdvertising();
                connections.stopDiscovery();
                log("LINK CONNECTED (peer accepted). NOT a delivered-message receipt.");
            } else {
                log("Connection rejected or failed: " + result.getStatus().getStatusCode());
            }
        }
        @Override public void onDisconnected(String endpointId) {
            if (endpointId.equals(connectedPeer)) {
                connected = false;connectedPeer = null;
                log("DISCONNECTED. Pending payload must not be marked delivered.");
            }
        }
    };

    private final EndpointDiscoveryCallback discovery = new EndpointDiscoveryCallback() {
        @Override public void onEndpointFound(String endpointId, DiscoveredEndpointInfo info) {
            runOnUiThread(() -> {
                if (!userConsented || connected) return;
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Request lab connection?")
                    .setMessage("Discovered: " + info.getEndpointName() +
                        "\nAnother confirmation with matching digits will follow.")
                    .setPositiveButton("Request", (d, which) ->
                        connections.requestConnection("Civic Relay Lab", endpointId, lifecycle)
                            .addOnFailureListener(e -> log("Request failed: " + e.getClass().getSimpleName())))
                    .setNegativeButton("Ignore", (d, which) -> {})
                    .show();
            });
        }
        @Override public void onEndpointLost(String endpointId) { log("Peer discovery lost."); }
    };

    private void advertise() {
        connections.startAdvertising("Civic Relay Lab", SERVICE_ID, lifecycle,
                new AdvertisingOptions.Builder().setStrategy(STRATEGY).build())
            .addOnSuccessListener(v -> log("Advertising LAB receiver; no radios toggled by app."))
            .addOnFailureListener(e -> log("Advertising unavailable: " + e.getClass().getSimpleName() +
                ". Check permissions and manually enable radios."));
    }
    private void discover() {
        connections.startDiscovery(SERVICE_ID, discovery,
                new DiscoveryOptions.Builder().setStrategy(STRATEGY).build())
            .addOnSuccessListener(v -> log("Discovering lab peers; no radios toggled by app."))
            .addOnFailureListener(e -> log("Discovery unavailable: " + e.getClass().getSimpleName() +
                ". Check permissions and manually enable radios."));
    }
    private void sendTest() {
        if (!userConsented || !connected || connectedPeer == null) {
            log("DENIED: obtain consent and accept a matching-code connection first.");return;
        }
        try {
            String id = UUID.randomUUID().toString();
            lastSentId = id;
            JSONObject packet = new JSONObject()
                .put("v", 1).put("type", "LAB_MESSAGE").put("id", id)
                .put("expiresAt", System.currentTimeMillis() + TTL_MILLIS)
                .put("body", "SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS");
            sendPacket(connectedPeer, packet);
            log("Message queued for Nearby transport; awaiting explicit receiver ACK for " + id);
        } catch (JSONException e) { log("Packet encoding failed."); }
    }

    private final PayloadCallback payloads = new PayloadCallback() {
        @Override public void onPayloadReceived(String endpointId, Payload payload) {
            if (!connected || !userConsented || !endpointId.equals(connectedPeer) ||
                payload.getType() != Payload.Type.BYTES || payload.asBytes() == null ||
                payload.asBytes().length > MAX_BYTES) return;
            try {
                JSONObject packet = new JSONObject(new String(payload.asBytes(), StandardCharsets.UTF_8));
                if (packet.optInt("v") != 1) return;
                String type = packet.optString("type");
                String id = packet.optString("id");
                if (!id.matches("[0-9a-fA-F-]{36}")) return;
                if ("LAB_MESSAGE".equals(type)) {
                    long expires = packet.optLong("expiresAt", 0);
                    if (expires < System.currentTimeMillis() ||
                        expires > System.currentTimeMillis() + TTL_MILLIS + 1000) {
                        log("Expired or malformed test message rejected.");return;
                    }
                    if (seenIds.size() >= 100) seenIds.clear();
                    if (seenIds.add(id)) log("LAB MESSAGE RECEIVED; duplicate guard active.");
                    JSONObject receipt = new JSONObject()
                        .put("v", 1).put("type", "LAB_RECEIPT").put("id", id);
                    sendPacket(endpointId, receipt);
                } else if ("LAB_RECEIPT".equals(type) && id.equals(lastSentId)) {
                    lastSentId = null;
                    log("RECEIVER ACK received over the accepted Nearby connection. LAB ONLY; not a rescue confirmation.");
                }
            } catch (JSONException e) { log("Invalid lab JSON ignored."); }
        }
        @Override public void onPayloadTransferUpdate(String endpointId, PayloadTransferUpdate update) {
            if (update.getStatus() == PayloadTransferUpdate.Status.FAILURE)
                log("Nearby payload transfer failed. Do not report delivered.");
        }
    };

    private void sendPacket(String endpointId, JSONObject packet) {
        byte[] bytes = packet.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) { log("Packet exceeds lab limit."); return; }
        connections.sendPayload(endpointId, Payload.fromBytes(bytes))
            .addOnFailureListener(e -> log("Send rejected by Nearby: " + e.getClass().getSimpleName()));
    }

    private void stopAndClear() {
        userConsented = false;
        connected = false;
        connectedPeer = null;
        lastSentId = null;
        waitingRole = null;
        seenIds.clear();
        connections.stopAdvertising();
        connections.stopDiscovery();
        connections.stopAllEndpoints();
        log("Local lab stopped; consent and message identifiers cleared.");
    }
    @Override protected void onStop() {
        super.onStop();
        stopAndClear(); // Deliberately no background discovery or transmission.
    }
}
