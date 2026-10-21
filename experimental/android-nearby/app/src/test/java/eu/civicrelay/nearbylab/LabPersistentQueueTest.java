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

    public static void main(String[] args) throws Exception {
        Path tmpDir = Files.createTempDirectory("oep-queue-test");
        Path file = tmpDir.resolve("queue.tsv");
        try {
            LabPersistentQueue q1 = new LabPersistentQueue(file, 1000L);
            q1.enqueue(ID1, "SOS_EXPLICIT", "LAB_PAYLOAD_1", 1000L, 5000L);
            q1.enqueue(ID2, "SAFE", "LAB_PAYLOAD_2", 1000L, 2000L);

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

            q3.purgeAll();
            check(!Files.exists(file), "purgeAll must delete backing file");
            System.out.println("LabPersistentQueueTest PASS (" + assertions + " assertions)");
        } finally {
            Files.deleteIfExists(file);
            Files.deleteIfExists(tmpDir);
        }
    }
}
