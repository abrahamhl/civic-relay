import { MessageEnvelopeSchema, type MessageEnvelope } from '@civic-relay/schemas';

/** Canonical JSON for identity comparison, not a signature or cryptographic hash. */
function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJSON).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJSON((value as Record<string, unknown>)[key])}`
    ).join(',')}}`;
  }
  throw new Error('Message must contain only JSON data');
}

export function parseUntrustedMessage(input: unknown, now: number): MessageEnvelope {
  const message = MessageEnvelopeSchema.parse(input);
  if (message.verificationState !== 'UNVERIFIED') {
    throw new Error('Untrusted messages must be UNVERIFIED; official provenance is not supported');
  }
  if (Date.parse(message.createdAt) > now) throw new Error('Message creation time is in the future');
  // Detach nested payloads and reject non-JSON runtime values before storing anything.
  return JSON.parse(canonicalJSON(message)) as MessageEnvelope;
}

export function isExpired(message: MessageEnvelope, now: number): boolean {
  return now >= Date.parse(message.createdAt) + message.ttl * 1000;
}

export function assertSameMessage(existing: MessageEnvelope, incoming: MessageEnvelope): void {
  // Delivery history belongs to observers, not to the immutable envelope identity.
  if (canonicalJSON({ ...existing, deliveryHistory: [] }) !==
      canonicalJSON({ ...incoming, deliveryHistory: [] })) {
    throw new Error(`Message ID conflict: ${incoming.id}`);
  }
}
