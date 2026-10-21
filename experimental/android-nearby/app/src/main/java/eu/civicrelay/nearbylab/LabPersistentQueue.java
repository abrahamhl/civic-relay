package eu.civicrelay.nearbylab;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Durable file-backed store-and-forward queue for the Android Nearby lab.
 * Survives process restarts, enforces TTL expiration, wipes payload on terminal states
 * (ACK_VERIFIED, EXPIRED, REVOKED) while keeping anti-replay tombstones, and deletes
 * the backing file completely on purgeAll() (STOP & CLEAR).
 */
public final class LabPersistentQueue {
    public enum Status { QUEUED, ACK_VERIFIED, EXPIRED, REVOKED }

    public static final class Record {
        public final String id;
        public final String category;
        public final long createdAtMs;
        public final long expiresAtMs;
        public final Status status;
        public final String payload;

        Record(String id, String category, long createdAtMs, long expiresAtMs, Status status, String payload) {
            this.id = id;
            this.category = category;
            this.createdAtMs = createdAtMs;
            this.expiresAtMs = expiresAtMs;
            this.status = status;
            this.payload = payload;
        }
    }

    // A research journal, not a general-purpose encrypted emergency message store.
    // Refuse arbitrary user text, precise location, or PII at the persistence boundary.
    private static final String LAB_ONLY_PAYLOAD = "SYNTHETIC_STATUS_CHECK_NOT_REAL_SOS";
    private static final int MAX_ENTRIES = 100;
    private static final int MAX_FILE_BYTES = 160000;
    private static final String HEADER = "# OEP LAB PERSISTENT QUEUE V1";
    private final Path storagePath;
    private final LinkedHashMap<String, Record> records = new LinkedHashMap<>();

    public LabPersistentQueue(Path storagePath, long nowMs) throws IOException {
        this.storagePath = storagePath;
        loadFromDisk(nowMs);
    }

    public synchronized Record enqueue(String id, String category, String payload, long nowMs, long ttlMs) throws IOException {
        if (!LabDeliveryGuard.validId(id)) throw new IllegalArgumentException("Invalid UUID");
        if (!("SAFE".equals(category) || "SOS_EXPLICIT".equals(category) ||
              "OTHERS_AFFECTED".equals(category) || "CANNOT_DETERMINE".equals(category))) {
            throw new IllegalArgumentException("Explicit human status category required");
        }
        if (!LAB_ONLY_PAYLOAD.equals(payload)) {
            throw new IllegalArgumentException("Invalid or oversized lab payload");
        }
        if (ttlMs < 1000L || ttlMs > 86400000L) {
            throw new IllegalArgumentException("Invalid TTL");
        }
        expireDue(nowMs);
        Record existing = records.get(id);
        if (existing != null) {
            if (existing.status != Status.QUEUED) {
                throw new IllegalStateException("Terminal message ID cannot be replayed");
            }
            return existing;
        }
        if (records.size() >= MAX_ENTRIES) {
            throw new IllegalStateException("Persistent queue full; fail closed");
        }
        Record created = new Record(id, category, nowMs, nowMs + ttlMs, Status.QUEUED, payload);
        records.put(id, created);
        try { persistToDisk(); }
        catch (IOException ex) { records.remove(id); throw ex; }
        return created;
    }

    public synchronized Record markAckVerified(String id, long nowMs) throws IOException {
        expireDue(nowMs);
        Record r = records.get(id);
        if (r == null) throw new IllegalArgumentException("Unknown message ID");
        if (r.status != Status.QUEUED) return r;
        Record updated = new Record(r.id, r.category, r.createdAtMs, r.expiresAtMs, Status.ACK_VERIFIED, "");
        records.put(id, updated);
        try { persistToDisk(); }
        catch (IOException ex) { records.put(id, r); throw ex; }
        return updated;
    }

    public synchronized Record revoke(String id, long nowMs) throws IOException {
        expireDue(nowMs);
        Record r = records.get(id);
        if (r == null) return null;
        Record updated = new Record(r.id, r.category, r.createdAtMs, r.expiresAtMs, Status.REVOKED, "");
        records.put(id, updated);
        try { persistToDisk(); }
        catch (IOException ex) { records.put(id, r); throw ex; }
        return updated;
    }

    public synchronized List<Record> snapshot(long nowMs) throws IOException {
        if (expireDue(nowMs)) persistToDisk();
        return new ArrayList<>(records.values());
    }

    public synchronized void purgeAll() throws IOException {
        records.clear();
        Files.deleteIfExists(storagePath);
    }

    private boolean expireDue(long nowMs) {
        boolean changed = false;
        for (Map.Entry<String, Record> entry : records.entrySet()) {
            Record r = entry.getValue();
            if (r.status == Status.QUEUED && nowMs >= r.expiresAtMs) {
                entry.setValue(new Record(r.id, r.category, r.createdAtMs, r.expiresAtMs, Status.EXPIRED, ""));
                changed = true;
            }
        }
        return changed;
    }

    private void loadFromDisk(long nowMs) throws IOException {
        records.clear();
        if (!Files.exists(storagePath)) return;
        // Fail closed on corruption; never ignore missing records or resurrect payloads.
        if (Files.size(storagePath) > MAX_FILE_BYTES) throw new IOException("Oversized lab queue; STOP & CLEAR required");
        List<String> lines = Files.readAllLines(storagePath, StandardCharsets.UTF_8);
        if (lines.isEmpty() || !HEADER.equals(lines.get(0)) || lines.size() > MAX_ENTRIES + 1) {
            throw new IOException("Invalid lab queue header or record count; STOP & CLEAR required");
        }
        try {
            for (int i = 1; i < lines.size(); i++) {
                String[] parts = lines.get(i).split("\t", -1);
                if (parts.length != 6 || !LabDeliveryGuard.validId(parts[0]) ||
                    !("SAFE".equals(parts[1]) || "SOS_EXPLICIT".equals(parts[1]) ||
                      "OTHERS_AFFECTED".equals(parts[1]) || "CANNOT_DETERMINE".equals(parts[1]))) {
                    throw new IllegalArgumentException("Invalid lab record fields");
                }
                long createdAt = Long.parseLong(parts[2]);
                long expiresAt = Long.parseLong(parts[3]);
                if (createdAt < 0 || expiresAt <= createdAt ||
                    expiresAt - createdAt > 86400000L || expiresAt < 0) {
                    throw new IllegalArgumentException("Invalid lab record TTL");
                }
                Status status = Status.valueOf(parts[4]);
                String rawPayload = parts[5];
                if (status == Status.QUEUED) {
                    if (!LAB_ONLY_PAYLOAD.equals(rawPayload)) {
                        throw new IllegalArgumentException("Invalid queued lab payload");
                    }
                } else if (!rawPayload.isEmpty()) {
                    throw new IllegalArgumentException("Terminal lab record contains a payload");
                }
                if (records.containsKey(parts[0])) throw new IllegalArgumentException("Duplicate persisted lab ID");
                records.put(parts[0], new Record(parts[0], parts[1], createdAt, expiresAt,
                    status, status == Status.QUEUED ? rawPayload : ""));
            }
        } catch (RuntimeException ex) {
            records.clear();
            throw new IOException("Corrupted lab queue; fail closed until STOP & CLEAR", ex);
        }
        if (expireDue(nowMs)) persistToDisk();
    }

    private void persistToDisk() throws IOException {
        Path tmp = storagePath.resolveSibling(storagePath.getFileName().toString() + ".tmp");
        StringBuilder sb = new StringBuilder(HEADER).append('\n');
        for (Record r : records.values()) {
            sb.append(r.id).append('\t')
              .append(r.category).append('\t')
              .append(r.createdAtMs).append('\t')
              .append(r.expiresAtMs).append('\t')
              .append(r.status.name()).append('\t')
              .append(r.status == Status.QUEUED ? r.payload : "")
              .append('\n');
        }
        Files.write(tmp, sb.toString().getBytes(StandardCharsets.UTF_8));
        try {
            Files.move(tmp, storagePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException notSupported) {
            Files.move(tmp, storagePath, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
