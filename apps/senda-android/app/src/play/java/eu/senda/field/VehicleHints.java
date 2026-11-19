package eu.senda.field;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;

import java.util.Arrays;

/**
 * Versión «Play»: pista DÉBIL «vas en un vehículo» de Google Play Services (Activity Recognition).
 * Puede ser un autobús o ir de pasajero: DriveAutostart exige confirmarla con la velocidad.
 */
public final class VehicleHints {
    private VehicleHints() { }
    public static boolean available() { return true; }

    @SuppressWarnings("MissingPermission")
    public static void register(Context c) {
        ActivityTransitionRequest req = new ActivityTransitionRequest(Arrays.asList(
                new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build(),
                new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT).build()));
        ActivityRecognition.getClient(c).requestActivityTransitionUpdates(req, pending(c));
    }

    @SuppressWarnings("MissingPermission")
    public static void unregister(Context c) { ActivityRecognition.getClient(c).removeActivityTransitionUpdates(pending(c)); }

    static PendingIntent pending(Context c) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, 0, new Intent(c, VehicleHintReceiver.class), flags);
    }
}
