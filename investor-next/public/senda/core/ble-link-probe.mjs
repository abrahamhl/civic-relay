/**
 * SENDA Drive · Sonda cooperativa de enlace BLE SENDA ↔ SENDA (16 bytes, sin red, 0 €).
 *
 * Permite medir de forma legal, consentida y verificable la conectividad real entre dos móviles
 * SENDA cercanos (latencia RTT en ms, tasa de respuesta y contraste con el canal físico de dos
 * rayos `twoRayV2vChannel`). NUNCA sondea dispositivos ajenos ni mide MACs de terceros.
 *
 * Trama binaria de 16 bytes:
 *   [0] MAGIC = 0xA6
 *   [1] versión (1 << 4) | kind (1 = PING, 2 = PONG)
 *   [2..5]  nonce uint32 BE
 *   [6..9]  tMs uint32 BE (ms mod 2³²)
 *   [10..13] senderId uint32 BE (efímero de sesión, sin PII)
 *   [14] flags (saltos/rol)
 *   [15] CRC-8 (polinomio 0x07) sobre bytes 0..14
 */
import { twoRayV2vChannel } from './drive-physics-v2.mjs';

export const PROBE_MAGIC = 0xa6;
export const PROBE_BYTES = 16;
export const PROBE_KIND = Object.freeze({ PING: 1, PONG: 2 });

export function crc8(bytes, len = bytes.length) {
  let c = 0;
  for (let i = 0; i < len; i++) {
    c ^= bytes[i];
    for (let b = 0; b < 8; b++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

export const isProbePack = (bytes) => bytes instanceof Uint8Array && bytes.length === PROBE_BYTES && bytes[0] === PROBE_MAGIC;

export function encodeProbe({ kind, nonce, tMs = Date.now(), senderId = 0, flags = 0 }) {
  if (kind !== PROBE_KIND.PING && kind !== PROBE_KIND.PONG) throw new Error('sonda BLE: tipo desconocido');
  const buf = new ArrayBuffer(PROBE_BYTES), dv = new DataView(buf), u = new Uint8Array(buf);
  dv.setUint8(0, PROBE_MAGIC);
  dv.setUint8(1, (1 << 4) | kind);
  dv.setUint32(2, nonce >>> 0);
  dv.setUint32(6, (Math.floor(tMs) >>> 0));
  dv.setUint32(10, senderId >>> 0);
  dv.setUint8(14, flags & 0xff);
  dv.setUint8(15, crc8(u, 15));
  return u;
}

export function decodeProbe(bytes) {
  if (!isProbePack(bytes)) throw new Error('sonda BLE: cabecera o tamaño no válido');
  const expectedCrc = crc8(bytes, 15);
  if (bytes[15] !== expectedCrc) throw new Error('sonda BLE: CRC-8 corrupto');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const v = dv.getUint8(1) >> 4, kind = dv.getUint8(1) & 0x0f;
  if (v !== 1 || (kind !== PROBE_KIND.PING && kind !== PROBE_KIND.PONG)) throw new Error('sonda BLE: versión o tipo inválido');
  return {
    v, kind,
    kindName: kind === PROBE_KIND.PING ? 'PING' : 'PONG',
    nonce: dv.getUint32(2),
    tMs: dv.getUint32(6),
    senderId: dv.getUint32(10),
    flags: dv.getUint8(14),
  };
}

/** Controlador de sonda cooperativa BLE para medir RTT real y contrastarlo con la física de dos rayos. */
export function createLinkProber({ senderId = Math.floor(Math.random() * 2 ** 32), freqHz = 2.44e9, htM = 1.2, hrM = 1.2 } = {}) {
  const pending = new Map();
  const rtts = [];
  let pingsSent = 0, pongsReceived = 0, pingsAnswered = 0, corrupted = 0;

  return {
    makePing(nowMs = Date.now(), nonce = ((Math.random() * 2 ** 32) >>> 0)) {
      const bytes = encodeProbe({ kind: PROBE_KIND.PING, nonce, tMs: nowMs, senderId });
      pending.set(nonce, nowMs);
      if (pending.size > 64) pending.delete(pending.keys().next().value);
      pingsSent++;
      return { bytes, nonce, sentAtMs: nowMs };
    },

    onReceive(bytes, nowMs = Date.now(), { distM = null, vRelMs = 0 } = {}) {
      let msg;
      try { msg = decodeProbe(bytes); } catch (e) { corrupted++; return { ok: false, error: e.message }; }
      if (msg.kind === PROBE_KIND.PING) {
        pingsAnswered++;
        const reply = encodeProbe({ kind: PROBE_KIND.PONG, nonce: msg.nonce, tMs: nowMs, senderId });
        return { ok: true, type: 'PING', nonce: msg.nonce, reply };
      }
      const sentAt = pending.get(msg.nonce);
      if (sentAt == null) return { ok: true, type: 'PONG_UNMATCHED', nonce: msg.nonce };
      pending.delete(msg.nonce);
      const rttMs = Math.max(0, +(nowMs - sentAt).toFixed(2));
      rtts.push(rttMs);
      if (rtts.length > 200) rtts.shift();
      pongsReceived++;
      const channel = distM != null && distM > 0 ? twoRayV2vChannel({ distM, freqHz, htM, hrM, vRelMs }) : null;
      return { ok: true, type: 'PONG', nonce: msg.nonce, rttMs, channel };
    },

    stats() {
      const sorted = [...rtts].sort((a, b) => a - b);
      const med = sorted.length ? sorted[sorted.length >> 1] : null;
      return {
        pingsSent, pongsReceived, pingsAnswered, corrupted,
        responseRate: pingsSent > 0 ? +(pongsReceived / pingsSent).toFixed(3) : null,
        medianRttMs: med,
        lastRttMs: rtts.length ? rtts.at(-1) : null,
      };
    },
  };
}
