package eu.civicrelay.nearbylab;

/**
 * Pure-Java dual-clock expiry for lab-only messages.
 * A wall-clock change must never extend a sender's monotonic message lifetime.
 */
public final class LabDeadlinePolicy {
    private LabDeadlinePolicy() {}

    public static boolean expired(long wallNow, long wallDeadline, long monotonicNow, long monotonicDeadline) {
        return wallNow >= wallDeadline || monotonicNow >= monotonicDeadline;
    }

    /** Never schedule an unbounded timer after a backwards clock adjustment. */
    public static long nextCheckDelayMs(long wallNow, long wallDeadline, long monotonicNow, long monotonicDeadline) {
        if (expired(wallNow, wallDeadline, monotonicNow, monotonicDeadline)) return 0L;
        return Math.max(1L, Math.min(wallDeadline-wallNow, monotonicDeadline-monotonicNow));
    }

    public static boolean elapsedTtlReached(long startedMonotonic, long currentMonotonic, long ttlMs) {
        if (startedMonotonic < 0 || ttlMs <= 0 || currentMonotonic < startedMonotonic)
            return true; // Fail closed on invalid or resetting monotonic clock.
        return currentMonotonic - startedMonotonic >= ttlMs;
    }
}
