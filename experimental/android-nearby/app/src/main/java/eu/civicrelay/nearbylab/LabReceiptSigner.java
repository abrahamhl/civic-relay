package eu.civicrelay.nearbylab;

import java.nio.charset.StandardCharsets;
import java.math.BigInteger;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.ECPublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Pure-Java cryptographic receipt signer/verifier for experimental two-phone trials.
 * Uses standard P-256 (secp256r1) + SHA256withECDSA supported across Android API 26+ and JDK 17+.
 * Binds receiver receipts to (messageId, challenge, peerId, issuedAtMs) so an untrusted relay
 * cannot forge a receiver ACK without the paired receiver's private key.
 */
public final class LabReceiptSigner {
    private static final String DOMAIN = "OEP_LAB_RECEIPT_V1";
    // Exact NIST P-256 subgroup order; field size alone also matches unrelated curves.
    private static final BigInteger P256_ORDER = new BigInteger(
        "FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16);
    private final PrivateKey privateKey;
    private final PublicKey publicKey;

    public LabReceiptSigner() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
            kpg.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair kp = kpg.generateKeyPair();
            this.privateKey = kp.getPrivate();
            this.publicKey = kp.getPublic();
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("EC P-256 unavailable", ex);
        }
    }

    public String publicKeyBase64() {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }

    static byte[] canonicalTranscript(String messageId, String challenge, String peerId, long issuedAtMs) {
        if (!LabDeliveryGuard.validId(messageId) || !LabDeliveryGuard.validId(challenge) ||
            peerId == null || peerId.isEmpty() || issuedAtMs <= 0L) {
            throw new IllegalArgumentException("Invalid receipt transcript fields");
        }
        String canonical = DOMAIN + "|" + messageId + "|" + challenge + "|" + peerId + "|" + issuedAtMs;
        return canonical.getBytes(StandardCharsets.UTF_8);
    }

    public String signReceipt(String messageId, String challenge, String peerId, long issuedAtMs) {
        byte[] transcript = canonicalTranscript(messageId, challenge, peerId, issuedAtMs);
        try {
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(privateKey);
            sig.update(transcript);
            return Base64.getEncoder().encodeToString(sig.sign());
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Failed to sign lab receipt", ex);
        }
    }

    /** Reject malformed or non-P256 public-key material before pinning a lab session. */
    public static boolean isSupportedPublicKey(String publicKeyB64) {
        if (publicKeyB64 == null || publicKeyB64.length() < 60 || publicKeyB64.length() > 512) return false;
        try {
            byte[] encoded = Base64.getDecoder().decode(publicKeyB64);
            if (encoded.length > 256) return false;
            PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(encoded));
            return key instanceof ECPublicKey &&
                ((ECPublicKey) key).getParams().getCurve().getField().getFieldSize() == 256 &&
                P256_ORDER.equals(((ECPublicKey) key).getParams().getOrder());
        } catch (IllegalArgumentException | GeneralSecurityException ex) {
            return false;
        }
    }

    public static boolean verifyReceipt(
            String publicKeyB64,
            String messageId,
            String challenge,
            String peerId,
            long issuedAtMs,
            String signatureB64) {
        if (signatureB64 == null || !isSupportedPublicKey(publicKeyB64)) return false;
        try {
            byte[] transcript = canonicalTranscript(messageId, challenge, peerId, issuedAtMs);
            byte[] keyBytes = Base64.getDecoder().decode(publicKeyB64);
            byte[] sigBytes = Base64.getDecoder().decode(signatureB64);
            PublicKey pub = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(keyBytes));
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initVerify(pub);
            sig.update(transcript);
            return sig.verify(sigBytes);
        } catch (IllegalArgumentException | GeneralSecurityException ex) {
            return false;
        }
    }
}
