package eu.senda.field;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Avisos activos por delante para las pantallas nativas (móvil y coche). Hoy nadie la alimenta desde el
 * servicio nativo (el bus de avisos corre en la app web, F2): por eso la pantalla dice «sin avisos».
 */
public final class DriveHazards {
    private static final List<String> HAZARDS = new ArrayList<>();
    private DriveHazards() { }
    public static synchronized void set(List<String> hazards) { HAZARDS.clear(); if (hazards != null) HAZARDS.addAll(hazards); }
    public static synchronized List<String> current() { return Collections.unmodifiableList(new ArrayList<>(HAZARDS)); }
}
