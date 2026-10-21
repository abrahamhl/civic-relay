package eu.civicrelay.nearbylab;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
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

    private static final int MAX_ENTRIES = 100;
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
        if (payload == null || payload.isEmpty() || payload.length() > 1024 ||
            payload.indexOf('\n') >= 0 || payload.indexOf('\r') >= 0 || payload.indexOf('\t') >= 0) {
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
        persistToDisk();
        return created;
    }

    public synchronized Record markAckVerified(String id, long nowMs) throws IOException {
        expireDue(nowMs);
        Record r = records.get(id);
        if (r == null) throw new IllegalArgumentException("Unknown message ID");
        if (r.status != Status.QUEUED) return r;
        Record updated = new Record(r.id, r.category, r.createdAtMs, r.expiresAtMs, Status.ACK_VERIFIED, "");
        records.put(id, updated);
        persistToDisk();
        return updated;
    }

    public synchronized Record revoke(String id, long nowMs) throws IOException {
        expireDue(nowMs);
        Record r = records.get(id);
        if (r == null) return null;
        Record updated = new Record(r.id, r.category, r.createdAtMs, r.expiresAtMs, Status.REVOKED, "");
        records.put(id, updated);
        persistToDisk();
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
        List<String> lines = Files.readAllLines(storagePath, StandardCharsets.UTF_8);
        for (String line : lines) {
            if (line.isEmpty() || line.startsWith("#")) continue;
            String[] parts = line.split("\t", -1);
            if (parts.length != 6) continue;
            String id = parts[0];
            String category = parts[1];
            long createdAt = Long.parseLong(parts[2]);
            long expiresAt = Long.parseLong(parts[3]);
            Status status = Status.valueOf(parts[4]);
            String payload = status == Status.QUEUED ? parts[5] : "";
            records.put(id, new Record(id, category, createdAt, expiresAt, status, payload));
        }
        if (expireDue(nowMs)) persistToDisk();
    }

    private void persistToDisk() throws IOException {
        Path tmp = storagePath.resolveSibling(storagePath.getFileName().toString() + ".tmp");
        StringBuilder sb = new StringBuilder("# OEP LAB PERSISTENT QUEUE V1\n");
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
        Files.move(tmp, storagePath, StandardCopyOption.REPLACE_EXISTING);
    }
}
