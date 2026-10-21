package eu.civicrelay.nearbylab;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Pure-Java opt-in LAB receipt guard. No Android APIs, radio operations, rescue dispatch,
 * signed identity or persistent storage. Session-local receipt is NOT physical proof until
 * measured on actual paired devices. All methods synchronised for callback concurrency.
 */
public final class LabDeliveryGuard {
    public enum ReceiptState { ACCEPTED, NO_PENDING, WRONG_ID, WRONG_PEER, EXPIRED }
    public enum IncomingState { NEW, DUPLICATE, REJECTED }
    private static final long MAX_TTL_MS = 60000L;
    private static final int MAX_SEEN = 100;
    private String pendingId;
    private String pendingPeer;
    private String pendingChallenge;
    private long pendingDeadline;
    private final LinkedHashMap<String, Long> seen = new LinkedHashMap<>();

    static boolean validId(String id) {
        if (id == null || id.length() != 36) return false;
        try { return UUID.fromString(id).toString().equalsIgnoreCase(id); }
        catch (IllegalArgumentException ex) { return false; }
    }

    /** One pending message per session. Expired messages may be replaced without a reset. */
    public synchronized boolean beginOutgoing(String id, String peer, String challenge, long now, long expiresAt) {
        clearExpiredOutgoing(now);
        if (pendingId != null || !validId(id) || !validId(challenge) ||
            peer == null || peer.isEmpty() ||
            expiresAt <= now || expiresAt - now > MAX_TTL_MS) return false;
        pendingId = id; pendingPeer = peer; pendingChallenge = challenge; pendingDeadline = expiresAt;
        return true;
    }

    public synchronized boolean hasPending(long now) {
        clearExpiredOutgoing(now);
        return pendingId != null;
    }

    private void clearExpiredOutgoing(long now) {
        if (pendingId != null && now >= pendingDeadline) clearOutgoing();
    }

    private void clearOutgoing() {
        pendingId = null; pendingPeer = null; pendingChallenge = null; pendingDeadline = 0L;
    }

    /** Late transport errors must not cancel a newer message. */
    public synchronized boolean abortOutgoing(String id) {
        if (pendingId != null && pendingId.equals(id)) {
            clearOutgoing();
            return true;
        }
        return false; // Late transport failure must not affect a newer active trial.
    }

    /** Binding to both the exact message and approved endpoint avoids cross-peer false ACK. */
    public synchronized ReceiptState acceptReceipt(String id, String peer, String challenge, long now) {
        if (pendingId == null) return ReceiptState.NO_PENDING;
        if (now >= pendingDeadline) {
            clearOutgoing();
            return ReceiptState.EXPIRED;
        }
        if (!pendingPeer.equals(peer)) return ReceiptState.WRONG_PEER;
        if (!pendingId.equals(id) || !pendingChallenge.equals(challenge)) return ReceiptState.WRONG_ID;
        clearOutgoing();
        return ReceiptState.ACCEPTED;
    }

    /** Reject malformed/expired/future-dated lab payloads without storing them. */
    public synchronized IncomingState acceptIncoming(String id, long expiresAt, long now) {
        if (!validId(id) || expiresAt <= now || expiresAt - now > MAX_TTL_MS + 1000L)
            return IncomingState.REJECTED;
        for (Iterator<Map.Entry<String, Long>> it = seen.entrySet().iterator(); it.hasNext();) {
            if (it.next().getValue() <= now) it.remove();
        }
        if (seen.containsKey(id)) return IncomingState.DUPLICATE;
        if (seen.size() >= MAX_SEEN) seen.remove(seen.keySet().iterator().next());
        seen.put(id, expiresAt);
        return IncomingState.NEW;
    }

    /** STOP/REVOKE invalidates pending receipts and in-memory dedup state. */
    public synchronized void reset() {
        clearOutgoing();
        seen.clear();
    }
}
