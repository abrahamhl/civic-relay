package eu.civicrelay.nearbylab;

/**
 * Pure JDK 17 unit tests for cryptographic receipt signing and verification.
 */
public final class LabReceiptSignerTest {
    private static int assertions = 0;
    private static final String MSG_ID = "11111111-1111-4111-8111-111111111111";
    private static final String CHALLENGE = "22222222-2222-4222-8222-222222222222";
    private static final String OTHER_ID = "33333333-3333-4333-8333-333333333333";

    private static void check(boolean ok, String msg) {
        if (!ok) throw new AssertionError(msg);
        assertions++;
    }

    public static void main(String[] args) {
        LabReceiptSigner receiver = new LabReceiptSigner();
        LabReceiptSigner attacker = new LabReceiptSigner();
        String pub = receiver.publicKeyBase64();
        String sig = receiver.signReceipt(MSG_ID, CHALLENGE, "PEER_A", 1700000000000L);

        check(LabReceiptSigner.verifyReceipt(pub, MSG_ID, CHALLENGE, "PEER_A", 1700000000000L, sig),
            "Valid signed receipt must verify");
        check(!LabReceiptSigner.verifyReceipt(pub, OTHER_ID, CHALLENGE, "PEER_A", 1700000000000L, sig),
            "Tampered messageId must fail verification");
        check(!LabReceiptSigner.verifyReceipt(pub, MSG_ID, OTHER_ID, "PEER_A", 1700000000000L, sig),
            "Tampered challenge must fail verification");
        check(!LabReceiptSigner.verifyReceipt(pub, MSG_ID, CHALLENGE, "PEER_B", 1700000000000L, sig),
            "Cross-peer replay must fail verification");
        check(!LabReceiptSigner.verifyReceipt(pub, MSG_ID, CHALLENGE, "PEER_A", 1700000000001L, sig),
            "Tampered timestamp must fail verification");
        check(!LabReceiptSigner.verifyReceipt(attacker.publicKeyBase64(), MSG_ID, CHALLENGE, "PEER_A", 1700000000000L, sig),
            "Wrong peer public key must fail verification");
        check(!LabReceiptSigner.verifyReceipt(pub, MSG_ID, CHALLENGE, "PEER_A", 1700000000000L, "not-base64!"),
            "Malformed signature must fail closed");

        System.out.println("LabReceiptSignerTest PASS (" + assertions + " assertions)");
    }
}
