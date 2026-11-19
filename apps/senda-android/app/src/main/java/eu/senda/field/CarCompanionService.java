package eu.senda.field;

import android.annotation.TargetApi;
import android.companion.AssociationInfo;
import android.companion.CompanionDeviceService;
import android.net.MacAddress;

/**
 * Android 12+: el sistema avisa cuando el coche que el usuario vinculó (CompanionDeviceManager) aparece o
 * desaparece, y permite arrancar el servicio en primer plano desde segundo plano (permiso
 * REQUEST_COMPANION_START_FOREGROUND_SERVICES_FROM_BACKGROUND). Comportamiento real por verificar en
 * dispositivos y coches concretos.
 */
@TargetApi(31)
public final class CarCompanionService extends CompanionDeviceService {
    private void on(String address, boolean appeared) {
        DriveController c = DriveController.get(this);
        if (c.isMyCar(address)) c.event(appeared ? "CAR_LINK_APPEARED" : "CAR_LINK_GONE");
    }
    private static String addr(AssociationInfo info) { MacAddress m = info.getDeviceMacAddress(); return m == null ? null : m.toString(); }

    @SuppressWarnings("deprecation") @Override public void onDeviceAppeared(String address) { on(address, true); }
    @SuppressWarnings("deprecation") @Override public void onDeviceDisappeared(String address) { on(address, false); }
    // Android 13+: el sistema llama a estas versiones.
    @TargetApi(33) @Override public void onDeviceAppeared(AssociationInfo info) { on(addr(info), true); }
    @TargetApi(33) @Override public void onDeviceDisappeared(AssociationInfo info) { on(addr(info), false); }
}
