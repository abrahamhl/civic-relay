package eu.senda.field;

import android.content.Context;

/** Versión base (sin Google Play Services): no hay detección «en vehículo»; solo el Bluetooth del coche. */
public final class VehicleHints {
    private VehicleHints() { }
    public static boolean available() { return false; }
    public static void register(Context c) { throw new UnsupportedOperationException("la versión base no incluye la detección de vehículo de Google"); }
    public static void unregister(Context c) { }
}
