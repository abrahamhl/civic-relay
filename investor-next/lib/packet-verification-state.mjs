/**
 * Verifying a signature against a public key supplied by its sender does not
 * authenticate that sender. Until explicit enrollment exists, all otherwise
 * valid packets remain UNTRUSTED; invalid packets must not enter the UI.
 */
/**
 * @template T
 * @param {T | null | undefined} packet
 * @param {{ valid?: unknown } | null | undefined} verification
 * @returns {{ packet: T | null, status: 'SIGNATURE_INVALID' | 'SIGNATURE_VALID_UNTRUSTED' }}
 */
export function assessPacketVerification(packet, verification) {
  if (!packet || verification?.valid !== true) {
    return { packet: null, status: 'SIGNATURE_INVALID' };
  }
  return { packet, status: 'SIGNATURE_VALID_UNTRUSTED' };
}
