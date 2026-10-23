/**
 * Verifying a signature against a public key supplied by its sender does not
 * authenticate that sender. Until explicit enrollment exists, all otherwise
 * valid packets remain UNTRUSTED; invalid packets must not enter the UI.
 */
export function assessPacketVerification(packet, verification) {
  if (!packet || verification?.valid !== true) {
    return { packet: null, status: 'SIGNATURE_INVALID' };
  }
  return { packet, status: 'SIGNATURE_VALID_UNTRUSTED' };
}
