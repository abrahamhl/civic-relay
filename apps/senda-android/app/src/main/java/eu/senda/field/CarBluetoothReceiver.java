package eu.senda.field;

import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Android 8–11: conexión y desconexión Bluetooth del coche vinculado. En Android 12+ lo hace
 * CarCompanionService (allí el arranque desde segundo plano exige la vía de CompanionDeviceManager).
 */
public final class CarBluetoothReceiver extends BroadcastReceiver {
    @SuppressWarnings("deprecation")
    @Override public void onReceive(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= 31) return;
        BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
        DriveController c = DriveController.get(context);
        if (d == null || !c.isMyCar(d.getAddress())) return;
        if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(intent.getAction())) c.event("CAR_LINK_APPEARED");
        else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(intent.getAction())) c.event("CAR_LINK_GONE");
    }
}
