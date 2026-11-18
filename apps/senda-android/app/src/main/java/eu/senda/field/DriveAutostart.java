package eu.senda.field;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Máquina de estados del arranque automático de SENDA Drive (Java puro, sin Android).
 *
 * Es una reimplementación EXACTA de la referencia packages/senda/src/drive-autostart.mjs y debe
 * reproducir packages/senda/conformance/drive-autostart.vectors.txt (DriveAutostartTest, en la CI).
 * Sin consentimiento de arranque automático no ocurre nada automático; el conductor siempre manda.
 * Con el coche vinculado presente no se cierra por inactividad: la sesión termina cuando el coche se va.
 * Los umbrales se DECLARAN al crearla (regla de veracidad): no hay valores por defecto.
 */
public final class DriveAutostart {
    public enum State { OFF, IDLE, CANDIDATE, DRIVING, ENDING }

    public static final class Params {
        public final double confirmSpeedMs, confirmWindowS, stopSpeedMs, idleStopS, endGraceS;
        public Params(double confirmSpeedMs, double confirmWindowS, double stopSpeedMs, double idleStopS, double endGraceS) {
            double[] all = { confirmSpeedMs, confirmWindowS, stopSpeedMs, idleStopS, endGraceS };
            String[] names = { "confirmSpeedMs", "confirmWindowS", "stopSpeedMs", "idleStopS", "endGraceS" };
            for (int i = 0; i < all.length; i++) if (Double.isNaN(all[i]) || Double.isInfinite(all[i])) throw new IllegalArgumentException("DriveAutostart: «" + names[i] + "» debe declararse");
            this.confirmSpeedMs = confirmSpeedMs; this.confirmWindowS = confirmWindowS; this.stopSpeedMs = stopSpeedMs; this.idleStopS = idleStopS; this.endGraceS = endGraceS;
        }
    }

    /** Acción para la plataforma: START_SESSION o STOP_SESSION con su motivo. */
    public static final class Action {
        public final String type, reason;
        Action(String type, String reason) { this.type = type; this.reason = reason; }
        @Override public String toString() { return type + ":" + reason; }
    }

    private final Params p;
    private State state = State.OFF;
    private boolean autoConsent, suppressed, manual, carLinked;
    private double candidateSince = Double.NaN, lastMovingT = Double.NaN, endingSince = Double.NaN;

    public DriveAutostart(Params params) {
        if (params == null) throw new IllegalArgumentException("DriveAutostart: los parámetros deben declararse");
        this.p = params;
    }

    public State state() { return state; }
    private State rest() { return autoConsent ? State.IDLE : State.OFF; }

    /** Evento: type (como en la referencia JS), t en s; ms solo para SPEED; autoStart solo para CONSENT. */
    public synchronized List<Action> handle(String type, double t, double ms, Boolean autoStart) {
        if (Double.isNaN(t) || Double.isInfinite(t)) throw new IllegalArgumentException("DriveAutostart: «t» debe declararse");
        List<Action> a = new ArrayList<>();
        switch (type) {
            case "CONSENT":
                if (Boolean.TRUE.equals(autoStart)) { autoConsent = true; if (state == State.OFF) state = State.IDLE; }
                else {
                    autoConsent = false;
                    if (state == State.DRIVING || state == State.ENDING) a.add(new Action("STOP_SESSION", "CONSENT_REVOKED"));
                    state = State.OFF; manual = false; suppressed = false; candidateSince = Double.NaN; endingSince = Double.NaN;
                }
                break;
            case "CAR_LINK_APPEARED":
                carLinked = true;
                if ((state == State.IDLE || state == State.CANDIDATE) && !suppressed) { state = State.DRIVING; lastMovingT = t; candidateSince = Double.NaN; a.add(new Action("START_SESSION", "CAR_LINK")); }
                else if (state == State.ENDING) { state = State.DRIVING; lastMovingT = t; endingSince = Double.NaN; }
                break;
            case "VEHICLE_HINT_ENTER":
                if (state == State.IDLE && !suppressed) { state = State.CANDIDATE; candidateSince = t; }
                else if (state == State.ENDING) { state = State.DRIVING; lastMovingT = t; endingSince = Double.NaN; }
                break;
            case "CAR_LINK_GONE":
            case "VEHICLE_HINT_EXIT":
                suppressed = false; if (type.equals("CAR_LINK_GONE")) carLinked = false;
                if (state == State.DRIVING && !manual) { state = State.ENDING; endingSince = t; }
                else if (state == State.CANDIDATE) { state = State.IDLE; candidateSince = Double.NaN; }
                break;
            case "SPEED":
                if (Double.isNaN(ms) || Double.isInfinite(ms)) throw new IllegalArgumentException("DriveAutostart: «ms» debe declararse");
                if (state == State.CANDIDATE) {
                    if (t - candidateSince > p.confirmWindowS) { state = State.IDLE; candidateSince = Double.NaN; }
                    else if (ms >= p.confirmSpeedMs) { state = State.DRIVING; lastMovingT = t; candidateSince = Double.NaN; a.add(new Action("START_SESSION", "VEHICLE_HINT_CONFIRMED_BY_SPEED")); }
                } else if ((state == State.DRIVING || state == State.ENDING) && ms >= p.stopSpeedMs) {
                    lastMovingT = t;
                    if (state == State.ENDING) { state = State.DRIVING; endingSince = Double.NaN; }
                }
                break;
            case "TICK":
                if (state == State.CANDIDATE && t - candidateSince > p.confirmWindowS) { state = State.IDLE; candidateSince = Double.NaN; }
                else if (state == State.DRIVING && !manual && !carLinked && t - lastMovingT >= p.idleStopS) { state = State.ENDING; endingSince = t; }
                else if (state == State.ENDING && t - endingSince >= p.endGraceS) { state = rest(); endingSince = Double.NaN; a.add(new Action("STOP_SESSION", "ENDED")); }
                break;
            case "USER_START":
                if (state != State.DRIVING) {
                    if (state == State.ENDING) { state = State.DRIVING; endingSince = Double.NaN; }
                    else { state = State.DRIVING; a.add(new Action("START_SESSION", "USER_START")); }
                    manual = true; lastMovingT = t; candidateSince = Double.NaN;
                }
                break;
            case "USER_STOP":
                if (state == State.DRIVING || state == State.ENDING) a.add(new Action("STOP_SESSION", "USER_STOP"));
                state = rest(); manual = false; candidateSince = Double.NaN; endingSince = Double.NaN; suppressed = autoConsent;
                break;
            default:
                throw new IllegalArgumentException("DriveAutostart: evento desconocido «" + type + "»");
        }
        return Collections.unmodifiableList(a);
    }
}
