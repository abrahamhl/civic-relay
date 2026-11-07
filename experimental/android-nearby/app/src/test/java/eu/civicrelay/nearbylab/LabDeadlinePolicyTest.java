package eu.civicrelay.nearbylab;

/** Strict offline-lab JVM regression gate, no Android emulator or RF claims. */
public final class LabDeadlinePolicyTest {
    private static int checks;
    private static void check(boolean ok, String why) {
        checks++;
        if (!ok) throw new AssertionError(why);
    }
    public static void main(String[] args) {
        check(!LabDeadlinePolicy.expired(100,160,1000,1060),"pre-deadline pending");
        check(LabDeadlinePolicy.expired(160,160,1059,1060),"wall deadline is inclusive");
        check(LabDeadlinePolicy.expired(100,160,1060,1060),"monotonic deadline is inclusive");
        check(LabDeadlinePolicy.expired(5,160,1061,1060),"backwards wall clock cannot extend delivery TTL");
        check(LabDeadlinePolicy.expired(500,160,1010,1060),"forwards wall clock conservatively expires");
        check(LabDeadlinePolicy.nextCheckDelayMs(100,160,1000,1060)==60L,"equal clock horizon");
        check(LabDeadlinePolicy.nextCheckDelayMs(120,160,1000,1060)==40L,"choose earlier wall deadline");
        check(LabDeadlinePolicy.nextCheckDelayMs(5,160,1050,1060)==10L,"choose monotonic after wall rollback");
        check(LabDeadlinePolicy.nextCheckDelayMs(160,160,1050,1060)==0L,"no timer when expired");
        check(!LabDeadlinePolicy.elapsedTtlReached(1000,1059,60),"ACK just inside TTL");
        check(LabDeadlinePolicy.elapsedTtlReached(1000,1060,60),"ACK at boundary rejected");
        check(LabDeadlinePolicy.elapsedTtlReached(1000,1070,60),"late ACK rejected");
        check(LabDeadlinePolicy.elapsedTtlReached(1000,990,60),"reset monotonic clock fails closed");
        check(LabDeadlinePolicy.elapsedTtlReached(-1,1050,60),"invalid started time fails closed");
        check(LabDeadlinePolicy.elapsedTtlReached(1000,1050,0),"nonpositive TTL fails closed");
        System.out.println("PASS: "+checks+" pure JVM dual-clock timeout invariants (LAB ONLY).");
    }
}
