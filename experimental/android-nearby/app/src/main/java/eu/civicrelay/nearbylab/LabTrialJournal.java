package eu.civicrelay.nearbylab;

import java.util.ArrayList;
import java.util.List;

/**
 * Local-only, consented pilot event journal; NO names, locations, peer IDs or distress content.
 * "ACK_RECEIVED" means paired application receipt, not an independently certified measurement.
 */
public final class LabTrialJournal {
    private static final int MAX_EVENTS = 120;
    private final List<String> rows = new ArrayList<>();
    public synchronized void record(String id, String outcome, long elapsedMs) {
        if (!LabDeliveryGuard.validId(id)) throw new IllegalArgumentException("Invalid trial UUID");
        if (!("ACK_RECEIVED".equals(outcome) || "SEND_FAILED".equals(outcome) ||
              "EXPIRED".equals(outcome) || "DISCONNECTED".equals(outcome)))
            throw new IllegalArgumentException("Invalid lab outcome");
        if (elapsedMs < -1 || elapsedMs > 3600000)
            throw new IllegalArgumentException("Invalid elapsed time");
        if (rows.size() >= MAX_EVENTS) rows.remove(0);
        rows.add(id + "," + outcome + "," + (elapsedMs < 0 ? "" : Long.toString(elapsedMs)));
    }
    public synchronized String csv() {
        StringBuilder out = new StringBuilder(
          "# OEP EXPERIMENTAL LOCAL TRIALS — NOT CERTIFIED OR EMERGENCY DELIVERY\n" +
          "trial_id,application_outcome,sender_monotonic_elapsed_ms\n");
        for (String row : rows) out.append(row).append('\n');
        return out.toString();
    }
    public synchronized int size() { return rows.size(); }
    public synchronized void clear() { rows.clear(); }
}
