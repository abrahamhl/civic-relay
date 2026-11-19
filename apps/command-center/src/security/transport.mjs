// Offline store-and-forward outbox.
//
// The outbox is intentionally dumb about networks: it never claims delivery.
// A message leaves only after an explicit acknowledgement by the peer. This is
// the part that makes "offline 100%" honest: the software can guarantee that
// nothing is lost locally and that ordering is deterministic. It cannot
// guarantee that a radio link exists, so it does not pretend to.

import { envelopeId } from './envelope.mjs';

export const TRANSPORT_STATUS = Object.freeze({
  OFFLINE_STORE_AND_FORWARD_READY: 'OFFLINE_STORE_AND_FORWARD_READY',
  NO_NETWORK_TRANSPORT_CONFIGURED: 'NO_NETWORK_TRANSPORT_CONFIGURED',
  RELAY_PATH_UNVERIFIED: 'RELAY_PATH_UNVERIFIED',
  MESSAGE_ACCEPTED: 'MESSAGE_ACCEPTED',
  DUPLICATE_REJECTED: 'DUPLICATE_REJECTED',
  REPLAY_REJECTED: 'REPLAY_REJECTED',
  EXPIRED_REJECTED: 'EXPIRED_REJECTED',
  OUTBOX_FULL: 'OUTBOX_FULL',
});

/**
 * @param {{now?: () => Date, maxItems?: number}} options
 */
export function createOutbox({ now = () => new Date(), maxItems = 512 } = {}) {
  const items = new Map();
  const seenIds = new Set();
  const seenNonces = new Set();

  async function enqueue(envelope, { verified = false } = {}) {
    const id = await envelopeId(envelope);
    const at = now();

    if (seenIds.has(id) || seenNonces.has(envelope.nonce)) {
      return { accepted: false, status: TRANSPORT_STATUS.DUPLICATE_REJECTED, id };
    }

    const expiresMs = Date.parse(envelope.expiresAt);
    if (!Number.isFinite(expiresMs) || at.getTime() >= expiresMs) {
      return { accepted: false, status: TRANSPORT_STATUS.EXPIRED_REJECTED, id };
    }

    if (items.size >= maxItems) {
      return { accepted: false, status: TRANSPORT_STATUS.OUTBOX_FULL, id };
    }

    items.set(id, {
      id,
      envelope,
      verified,
      enqueuedAtUTC: at.toISOString(),
      attempts: 0,
      state: 'QUEUED',
    });
    seenIds.add(id);
    seenNonces.add(envelope.nonce);

    return { accepted: true, status: TRANSPORT_STATUS.MESSAGE_ACCEPTED, id };
  }

  function pending() {
    return [...items.values()]
      .filter((item) => item.state === 'QUEUED')
      .sort((a, b) => {
        const diff = Date.parse(a.envelope.createdAt) - Date.parse(b.envelope.createdAt);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });
  }

  function ack(id, { by = 'peer', at = now() } = {}) {
    const item = items.get(id);
    if (!item) return { ok: false, reason: 'NOT_FOUND' };
    item.state = 'ACKNOWLEDGED';
    item.ackedAtUTC = at.toISOString();
    item.ackedBy = by;
    return { ok: true };
  }

  function markAttempt(id, { at = now(), status = 'ATTEMPTED' } = {}) {
    const item = items.get(id);
    if (!item) return { ok: false, reason: 'NOT_FOUND' };
    item.attempts += 1;
    item.lastAttemptAtUTC = at.toISOString();
    item.lastAttemptStatus = status;
    return { ok: true, attempts: item.attempts };
  }

  function expire({ at = now() } = {}) {
    const expired = [];
    for (const item of items.values()) {
      const expiresMs = Date.parse(item.envelope.expiresAt);
      if (item.state === 'QUEUED' && Number.isFinite(expiresMs) && at.getTime() >= expiresMs) {
        item.state = 'EXPIRED';
        expired.push(item.id);
      }
    }
    return expired;
  }

  function get(id) {
    return items.get(id) ?? null;
  }

  function stats() {
    const states = { QUEUED: 0, ACKNOWLEDGED: 0, EXPIRED: 0 };
    for (const item of items.values()) states[item.state] = (states[item.state] ?? 0) + 1;
    return {
      total: items.size,
      ...states,
      seenNonces: seenNonces.size,
      capacity: maxItems,
    };
  }

  return { enqueue, pending, ack, markAttempt, expire, get, stats };
}

/**
 * Replay protection for inbound messages. A caller verifies an envelope first
 * and only then commits it, so an invalid signature cannot poison the guard.
 */
export function createReplayGuard() {
  const nonces = new Set();
  const ids = new Set();

  function commit(id, nonce) {
    if (ids.has(id) || nonces.has(nonce)) {
      return { ok: false, status: TRANSPORT_STATUS.REPLAY_REJECTED };
    }
    ids.add(id);
    nonces.add(nonce);
    return { ok: true };
  }

  function has(id, nonce) {
    return ids.has(id) || nonces.has(nonce);
  }

  return { commit, has, stats: () => ({ ids: ids.size, nonces: nonces.size }) };
}

/**
 * Honest transport inventory. There is no radio stack wired in this build.
 * The UI must render this instead of inventing a link status.
 */
export function getTransportInventory() {
  return {
    status: TRANSPORT_STATUS.NO_NETWORK_TRANSPORT_CONFIGURED,
    offlineQueue: TRANSPORT_STATUS.OFFLINE_STORE_AND_FORWARD_READY,
    configuredPaths: [],
    unverifiedPaths: [
      'LoRa / Meshtastic (requires hardware + frequency licence)',
      'Wi-Fi Direct / BLE (requires pairing and OS permissions)',
      'Sneakernet export (requires signed media)',
    ],
    guarantees: [
      'A message is never marked delivered without an explicit peer ack.',
      'Duplicate ids and nonces are rejected.',
      'Expired messages are rejected at enqueue time.',
      'Ordering is deterministic by createdAt then id.',
    ],
    nonGuarantees: [
      'No radio link is claimed.',
      'No peer identity is trusted without out-of-band fingerprint comparison.',
      'No key is persisted by this build.',
    ],
  };
}
