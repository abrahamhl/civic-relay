package eu.civicrelay.nearbylab;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Pure JDK 17 unit tests for durable store-and-forward queue persistence across restarts.
 */
public final class LabPersistentQueueTest {
    private static int assertions = 0;
    private static final String ID1 = "11111111-1111-4111-8111-111111111111";
    private static final String ID2 = "22222222-2222-4222-8222-222222222222";

    private static void check(boolean ok, String why) {
        if (!ok) throw new AssertionError(why);
        assertions++;
    }

    private static void assertConflict(LabPersistentQueue queue, String category,
                                       String payload, long ttl, String field) throws Exception {
        boolean rejected = false;
        try { queue.enqueue(ID1, category, payload, 1100L, ttl); }
        catch (IllegalStateException expected) { rejected = true; }
        check(rejected, "Reusing a UUID with different " + field + " must fail closed");
    }

    /** A corrupt file must fail closed without discarding tombstones or rewriting evidence. */
    private static void assertRestoreRejected(Path file, String content, String why) throws Exception {
        Files.writeString(file, content);
        boolean rejected = false;
        try { new LabPersistentQueue(file, 1000L); }
        catch (java.io.IOException expected) {
            rejected = expected.getMessage().contains("Invalid lab queue");
        }
        check(rejected, why);
        check(Files.readString(file).equals(content), "Corrupt file must remain unchanged");
    }

    private static void testCorruptRestore(Path dir) throws Exception {
        Path file = dir.resolve("corrupt.tsv");
        String header = "# OEP LAB PERSISTENT QUEUE V1\n";
        try {
            assertRestoreRejected(file, "", "Empty persisted file must fail closed");
            assertRestoreRejected(file, ID1 + "\tSAFE\t1000\t3000\tQUEUED\tLAB\n", "Missing header");
            assertRestoreRejected(file, header + ID1 + "\tSAFE\tNaN\t3000\tQUEUED\tLAB\n", "Invalid timestamp");
            assertRestoreRejected(file, header + ID1 + "\tSAFE\t1000\t3000\tUNKNOWN\tLAB\n", "Invalid state");
            assertRestoreRejected(file, header + ID1 + "\tINVALID\t1000\t3000\tQUEUED\tLAB\n", "Invalid category");
            assertRestoreRejected(file, header + ID1 + "\tSAFE\t1000\t3000\tACK_VERIFIED\tSECRET\n", "Terminal plaintext");
            String record = ID1 + "\tSAFE\t1000\t3000\tQUEUED\tLAB\n";
            assertRestoreRejected(file, header + record + record, "Duplicate UUID");
            StringBuilder tooMany = new StringBuilder(header);
            for (int i = 0; i < 101; i++) {
                tooMany.append(String.format("%08d-1111-4111-8111-111111111111", i))
                    .append("\tSAFE\t1000\t3000\tQUEUED\tLAB\n");
            }
            assertRestoreRejected(file, tooMany.toString(), "Over-capacity restore");
        } finally {
            Files.deleteIfExists(file);
            Files.deleteIfExists(file.resolveSibling("corrupt.tsv.tmp"));
        }
    }

    public static void main(String[] args) throws Exception {
        Path tmpDir = Files.createTempDirectory("oep-queue-test");
        Path file = tmpDir.resolve("queue.tsv");
        try {
            LabPersistentQueue q1 = new LabPersistentQueue(file, 1000L);
            q1.enqueue(ID1, "SOS_EXPLICIT", "LAB_PAYLOAD_1", 1000L, 5000L);
            q1.enqueue(ID2, "SAFE", "LAB_PAYLOAD_2", 1000L, 2000L);

            // Exact retry remains idempotent; conflicting UUID reuse must fail closed.
            check(q1.enqueue(ID1, "SOS_EXPLICIT", "LAB_PAYLOAD_1", 1100L, 5000L).id.equals(ID1),
                "Identical retry must return the original record");
            assertConflict(q1, "SAFE", "LAB_PAYLOAD_1", 5000L, "category");
            assertConflict(q1, "SOS_EXPLICIT", "DIFFERENT_PAYLOAD", 5000L, "payload");
            assertConflict(q1, "SOS_EXPLICIT", "LAB_PAYLOAD_1", 4000L, "TTL");
            check(q1.snapshot(1100L).size() == 2, "Conflicts must not change queue size");

            // Simulate process restart at t=2500ms (ID1 still active, ID2 still active)
            LabPersistentQueue q2 = new LabPersistentQueue(file, 2500L);
            List<LabPersistentQueue.Record> snap = q2.snapshot(2500L);
            check(snap.size() == 2, "Both records must survive process restart");
            check("LAB_PAYLOAD_1".equals(snap.get(0).payload), "Active queued payload must persist");

            // Mark ID1 as ACK_VERIFIED; payload must be wiped on disk and tombstone must block replay
            LabPersistentQueue.Record acked = q2.markAckVerified(ID1, 2600L);
            check(acked.status == LabPersistentQueue.Status.ACK_VERIFIED && acked.payload.isEmpty(),
                "ACK_VERIFIED must wipe payload");

            // Restart at t=3500ms: ID2 (expiresAt=3000ms) must automatically transition to EXPIRED with empty payload
            LabPersistentQueue q3 = new LabPersistentQueue(file, 3500L);
            List<LabPersistentQueue.Record> afterExpiry = q3.snapshot(3500L);
            check(afterExpiry.get(1).status == LabPersistentQueue.Status.EXPIRED && afterExpiry.get(1).payload.isEmpty(),
                "Expired record must clear payload on reload");

            boolean replayRejected = false;
            try {
                q3.enqueue(ID1, "SOS_EXPLICIT", "REPLAY", 3600L, 5000L);
            } catch (IllegalStateException expected) {
                replayRejected = true;
            }
            check(replayRejected, "Tombstone must reject replay after restart");

            // Expired payloads must be flushed even when API exits early or throws.
            Path expiryFile = tmpDir.resolve("expiry.tsv");
            for (int branch = 0; branch < 3; branch++) {
                Files.deleteIfExists(expiryFile);
                LabPersistentQueue expiring = new LabPersistentQueue(expiryFile, 1000L);
                expiring.enqueue(ID1, "SAFE", "SYNTHETIC_EXPIRED_SECRET", 1000L, 1000L);
                if (branch == 0) {
                    check(expiring.markAckVerified(ID1, 2500L).status == LabPersistentQueue.Status.EXPIRED,
                        "Late ACK must not revive expired payload");
                } else if (branch == 1) {
                    boolean denied = false;
                    try { expiring.enqueue(ID1, "SAFE", "REPLAY", 2500L, 1000L); }
                    catch (IllegalStateException expected) { denied = true; }
                    check(denied, "Expired UUID replay must be rejected");
                } else {
                    check(expiring.revoke(ID2, 2500L) == null, "Unknown revoke remains a no-op");
                }
                check(!Files.readString(expiryFile).contains("SYNTHETIC_EXPIRED_SECRET"),
                    "Expiry must remove plaintext from persistent storage on every early exit");
            }
            Files.deleteIfExists(expiryFile);

            // An interrupted write can leave a second plaintext queue copy.
            Path staleTmp = file.resolveSibling(file.getFileName().toString() + ".tmp");
            Files.writeString(staleTmp, "SYNTHETIC_STALE_PAYLOAD");
            q3.purgeAll();
            check(!Files.exists(file), "purgeAll must delete backing file");
            check(!Files.exists(staleTmp), "purgeAll must delete interrupted-write temporary file");
            testCorruptRestore(tmpDir);
            System.out.println("LabPersistentQueueTest PASS (" + assertions + " assertions)");
        } finally {
            Files.deleteIfExists(file);
            Files.deleteIfExists(file.resolveSibling(file.getFileName().toString() + ".tmp"));
            Files.deleteIfExists(tmpDir);
        }
    }
}
