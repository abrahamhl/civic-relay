package eu.civicrelay.nearbylab;

/**
 * JDK-only deterministic guard tests. Executed in GitHub Actions without
 * Android emulators or claimed physical radio evidence.
 */
public final class LabDeliveryGuardTest {
    private static int assertions;
    private static final String ID1 = "11111111-1111-4111-8111-111111111111";
    private static final String ID2 = "22222222-2222-4222-8222-222222222222";
    private static void check(boolean ok, String why) {
        assertions++;
        if (!ok) throw new AssertionError(why);
    }
    public static void main(String[] args) {
        final long now = 1_000_000L;
        LabDeliveryGuard g = new LabDeliveryGuard();
        check(!g.beginOutgoing("INVALID", "A", now, now+60000), "malformed outbound rejected");
        check(!g.beginOutgoing(ID1, "A", now, now+60001), "outbound TTL bounded");
        check(!g.beginOutgoing(ID1, "A", now, now), "expired outbound rejected");
        check(g.beginOutgoing(ID1, "A", now, now+60000), "valid outbound accepted");
        check(!g.beginOutgoing(ID2, "A", now, now+60000), "second pending blocked");
        check(g.acceptReceipt(ID1, "B", now+1)==LabDeliveryGuard.ReceiptState.WRONG_PEER, "peer mismatch rejected");
        check(g.acceptReceipt(ID2, "A", now+1)==LabDeliveryGuard.ReceiptState.WRONG_ID, "ID mismatch rejected");
        check(g.hasPending(now+100), "forged receipts do not clear pending");
        check(g.acceptReceipt(ID1, "A", now+100)==LabDeliveryGuard.ReceiptState.ACCEPTED, "matching app-level ACK accepted");
        check(!g.hasPending(now+101), "ACK closes pending");
        check(g.acceptReceipt(ID1, "A", now+102)==LabDeliveryGuard.ReceiptState.NO_PENDING, "replayed ACK rejected");
        check(g.beginOutgoing(ID1, "A", now+1000, now+1100), "new trial reserved");
        check(g.acceptReceipt(ID1, "A", now+1100)==LabDeliveryGuard.ReceiptState.EXPIRED, "late receipt rejected");
        check(!g.hasPending(now+1100), "expired receipt clears pending");
        check(g.beginOutgoing(ID2, "A", now+1200, now+1300), "outbound retry possible");
        check(!g.hasPending(now+1300), "timeout unblocks next send");
        check(g.beginOutgoing(ID1, "A", now+1300, now+1400), "new trial after timeout");
        g.abortOutgoing(ID2);
        check(g.hasPending(now+1301), "stale failure cannot cancel newer ID");
        g.abortOutgoing(ID1);
        check(!g.hasPending(now+1302), "current transport failure resets outstanding ID");
        check(g.acceptIncoming(ID1, now+1000, now)==LabDeliveryGuard.IncomingState.NEW, "inbound accepted");
        check(g.acceptIncoming(ID1, now+1000, now)==LabDeliveryGuard.IncomingState.DUPLICATE, "inbound deduplicated");
        check(g.acceptIncoming(ID2, now-1, now)==LabDeliveryGuard.IncomingState.REJECTED, "expired inbound rejected");
        check(g.acceptIncoming("fake", now+10, now)==LabDeliveryGuard.IncomingState.REJECTED, "malformed inbound rejected");
        check(g.acceptIncoming(ID2, now+61002, now)==LabDeliveryGuard.IncomingState.REJECTED, "too-far-future rejected");
        check(g.acceptIncoming(ID1, now+2000, now+1000)==LabDeliveryGuard.IncomingState.NEW,
              "expired dedup marker released, not mistaken for rescue proof");
        g.reset();
        check(g.acceptReceipt(ID1, "A", now+1000)==LabDeliveryGuard.ReceiptState.NO_PENDING, "revocation clears outstanding receipt");
        check(g.acceptIncoming(ID1, now+2000, now+1000)==LabDeliveryGuard.IncomingState.NEW, "revocation clears seen IDs");
        for (int i=0;i<110;i++) {
            String id = String.format("%08x-0000-4000-8000-%012x", i+100, i+100);
            check(g.acceptIncoming(id, now+2000, now+1000)==LabDeliveryGuard.IncomingState.NEW,
                  "bounded input accepted at index "+i);
        }
        check(g.acceptIncoming(ID1, now+2000, now+1000)==LabDeliveryGuard.IncomingState.NEW,
              "oldest dedup ID evicted after bounded capacity");
        System.out.println("PASS: "+assertions+" deterministic JVM guard checks; simulated lab only.");
    }
}
