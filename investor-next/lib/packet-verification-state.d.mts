export function assessPacketVerification<T>(
  packet: T | null | undefined,
  verification: { valid?: unknown } | null | undefined
): { packet: T | null; status: 'SIGNATURE_INVALID' | 'SIGNATURE_VALID_UNTRUSTED' };
