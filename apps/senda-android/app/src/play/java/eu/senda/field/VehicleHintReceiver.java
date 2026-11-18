package eu.senda.field;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;

/** Traduce las transiciones «en vehículo» de Google a eventos VEHICLE_HINT_ENTER / VEHICLE_HINT_EXIT. */
public final class VehicleHintReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return;
        ActivityTransitionResult r = ActivityTransitionResult.extractResult(intent);
        if (r == null) return;
        for (ActivityTransitionEvent e : r.getTransitionEvents()) {
            if (e.getActivityType() != DetectedActivity.IN_VEHICLE) continue;
            DriveController.get(context).event(e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER ? "VEHICLE_HINT_ENTER" : "VEHICLE_HINT_EXIT");
        }
    }
}
