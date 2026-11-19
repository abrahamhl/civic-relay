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
    private final List<String> telemetryJsonRows = new ArrayList<>();

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

    /** Record full A1 transport telemetry row without fabricated physical RF claims or PII. */
    public synchronized void recordTelemetry(
            String trialId, String observedAtUtc, String availableAtUtc,
            String bootId, int bootCounter, String bearerId,
            boolean authorized, boolean consentActive,
            String custodyState, boolean destinationAckVerified,
            String nonce, int attemptCount, int payloadBytes,
            long airtimeMs, double energyMj, String energySource,
            String srlgFaultId, String clockStatus, String lossReason) {
        if (!LabDeliveryGuard.validId(trialId) || !LabDeliveryGuard.validId(nonce))
            throw new IllegalArgumentException("Invalid trial/nonce UUID");
        if (observedAtUtc == null || availableAtUtc == null || bootId == null || bootId.isEmpty() ||
            bearerId == null || bearerId.isEmpty())
            throw new IllegalArgumentException("Missing temporal, boot or bearer metadata");
        if (bootCounter < 0 || attemptCount < 0 || payloadBytes < 1 || airtimeMs < 0 || energyMj < 0)
            throw new IllegalArgumentException("Negative or zero telemetry counter");
        if (!("CREATED".equals(custodyState) || "QUEUED".equals(custodyState) ||
              "CUSTODY_ACK".equals(custodyState) || "DESTINATION_ACK".equals(custodyState) ||
              "REVOKED".equals(custodyState) || "EXPIRED".equals(custodyState) ||
              "FAILED_EXHAUSTED".equals(custodyState)))
            throw new IllegalArgumentException("Invalid custodyState");
        if ("CUSTODY_ACK".equals(custodyState) && destinationAckVerified)
            throw new IllegalArgumentException("CUSTODY_ACK must never claim destination_ack_verified=true");
        if (!("MEASURED_INSTRUMENT".equals(energySource) || "HYPOTHETICAL_CATALOG".equals(energySource) ||
              "UNAVAILABLE".equals(energySource)))
            throw new IllegalArgumentException("Invalid energySource");
        if (!("MONOTONIC_OK".equals(clockStatus) || "WALL_ADJUSTED".equals(clockStatus) ||
              "CLOCK_INCOHERENT_QUARANTINE".equals(clockStatus)))
            throw new IllegalArgumentException("Invalid clockStatus");
        if (telemetryJsonRows.size() >= MAX_EVENTS) telemetryJsonRows.remove(0);
        String line = "{\"schema\":\"senda-physical-telemetry/1\"" +
            ",\"trialId\":\"" + safeToken(trialId) + "\"" +
            ",\"observedAtUtc\":\"" + safeToken(observedAtUtc) + "\"" +
            ",\"availableAtUtc\":\"" + safeToken(availableAtUtc) + "\"" +
            ",\"bootId\":\"" + safeToken(bootId) + "\"" +
            ",\"bootCounter\":" + bootCounter +
            ",\"bearerId\":\"" + safeToken(bearerId) + "\"" +
            ",\"authorized\":" + authorized +
            ",\"consentActive\":" + consentActive +
            ",\"custodyState\":\"" + safeToken(custodyState) + "\"" +
            ",\"destinationAckVerified\":" + destinationAckVerified +
            ",\"nonce\":\"" + safeToken(nonce) + "\"" +
            ",\"attemptCount\":" + attemptCount +
            ",\"bytes\":" + payloadBytes +
            ",\"airtimeMs\":" + airtimeMs +
            ",\"energyMj\":" + energyMj +
            ",\"energySource\":\"" + safeToken(energySource) + "\"" +
            ",\"srlgFaultId\":" + (srlgFaultId == null || srlgFaultId.isEmpty() ? "null" : "\"" + safeToken(srlgFaultId) + "\"") +
            ",\"clockStatus\":\"" + safeToken(clockStatus) + "\"" +
            ",\"lossReason\":" + (lossReason == null || lossReason.isEmpty() ? "null" : "\"" + safeToken(lossReason) + "\"") +
            ",\"physicalRfVerified\":false}";
        telemetryJsonRows.add(line);
    }

    private static String safeToken(String raw) {
        return raw.replaceAll("[^A-Za-z0-9_.:+/-]", "_");
    }

    public synchronized String telemetryNdjson() {
        StringBuilder out = new StringBuilder();
        for (String row : telemetryJsonRows) out.append(row).append('\n');
        return out.toString();
    }

    public synchronized String csv() {
        StringBuilder out = new StringBuilder(
          "# OEP EXPERIMENTAL LOCAL TRIALS — NOT CERTIFIED OR EMERGENCY DELIVERY\n" +
          "trial_id,application_outcome,sender_monotonic_elapsed_ms\n");
        for (String row : rows) out.append(row).append('\n');
        return out.toString();
    }
    public synchronized int size() { return rows.size(); }
    public synchronized int telemetrySize() { return telemetryJsonRows.size(); }
    public synchronized void clear() { rows.clear(); telemetryJsonRows.clear(); }
}
