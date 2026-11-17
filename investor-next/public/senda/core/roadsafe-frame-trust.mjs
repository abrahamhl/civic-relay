/**
 * SENDA RoadSafe · P0-1 — Política de autenticidad, repetición y plausibilidad de las tramas de aviso.
 *
 * Problema verificado (auditoría RoadSafe 2026-11-17): `encodeHazard`/`decodeHazard`/`relayHazard`
 * (road-guard.mjs) manejan una trama de 24 bytes SIN autenticar. Cualquiera con un emisor BLE puede
 * fabricar «CRASH a 200 m» y, sin esta capa, el receptor la trataría como un aviso legítimo.
 *
 * Decisión: la trama de 24 bytes sigue existiendo (cabe en un anuncio BLE «legacy» de 31 bytes), pero
 * solo puede producir una PISTA ORIENTATIVA (`UNVERIFIED_PEER_HINT`), nunca un aviso crítico. Para
 * autenticidad se define una CÁPSULA FIRMADA: trama (24) + huella de clave (4) + firma ECDSA P-256
 * IEEE-P1363 (64) = 92 bytes; cabe en anuncios BLE extendidos (hasta 254 bytes de datos, Bluetooth 5),
 * GATT, LoRa o datos móviles. La firma cubre la trama con el campo «saltos» a cero para que los relés
 * puedan incrementar saltos sin romperla.
 *
 * Qué NO garantiza una firma: que el peligro sea verdad. Garantiza QUIÉN lo emitió (una clave inscrita)
 * y que no se alteró. La verdad la estiman la corroboración (H-ROAD-2) y las fuentes oficiales.
 * Resistencia Sybil: solo cuentan claves inscritas en el almacén de confianza (`trustStore`); una
 * clave nueva sin inscribir es equivalente a no firmar.
 *
 * Niveles de salida (`trust`):
 *   REJECT_*                → no se presenta.
 *   DUPLICATE               → ya visto (repetición o relé del mismo evento): no se vuelve a avisar.
 *   UNVERIFIED_PEER_HINT    → trama sin firma plausible: como mucho ADVISORY (texto/icono discreto).
 *   SIGNED_PEER             → firmada por dispositivo inscrito: ADVISORY, apta para corroboración.
 *   AUTHORITY_VERIFIED      → firmada por clave institucional inscrita y vigente: puede alcanzar
 *                             WARNING; incluso así, la presentación la decide la política de factores
 *                             humanos (roadsafe-secondary-risk.mjs), no esta capa.
 */
import { decodeHazard, HAZARD_BYTES } from './road-guard.mjs';

const subtle = globalThis.crypto.subtle;
const R = 6_371_000;
const distM = (a, b) => { const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

export const CAPSULE_BYTES = HAZARD_BYTES + 4 + 64;
export const FRAME_TRUST = Object.freeze(['REJECT_MALFORMED', 'REJECT_UNKNOWN_TYPE', 'REJECT_CLOCK', 'REJECT_STALE', 'REJECT_IMPLAUSIBLE', 'REJECT_BAD_SIGNATURE', 'REJECT_REVOKED_KEY', 'DUPLICATE', 'UNVERIFIED_PEER_HINT', 'SIGNED_PEER', 'AUTHORITY_VERIFIED']);
/** Techo de presentación por nivel de confianza (la política de factores humanos puede bajarlo, nunca subirlo). */
export const PRESENTATION_CEILING = Object.freeze({ UNVERIFIED_PEER_HINT: 'ADVISORY', SIGNED_PEER: 'ADVISORY', AUTHORITY_VERIFIED: 'WARNING' });

/** Parámetros de plausibilidad: HIPÓTESIS DE DISEÑO declaradas, sustituibles por medidas de campo. */
export const FRAME_POLICY = Object.freeze({
  maxAgeS: 20,            // aviso de evento puntual (frenada, choque) más viejo que esto no se presenta
  maxFutureS: 2,          // tolerancia de reloj entre emisor y receptor
  radioRangeM: 400,       // alcance BLE coche-coche supuesto por salto (HIPÓTESIS; medir en campo)
  maxVehicleSpeedMs: 70,  // 252 km/h: por encima, la trama es implausible
  maxDecelMs2: 15,        // por encima de ~1,5 g es un golpe o un error, no una frenada
  replayTtlS: 120,
});

/** Caché de repetición: clave = (id, t, tipo); los saltos se excluyen para que un relé cuente como el mismo evento. */
export function createReplayCache({ ttlS = FRAME_POLICY.replayTtlS, max = 4096 } = {}) {
  const seen = new Map();
  return {
    has(key, now) { const t = seen.get(key); return t != null && now - t <= ttlS; },
    add(key, now) { seen.set(key, now); if (seen.size > max) { const first = seen.keys().next().value; seen.delete(first); } },
    prune(now) { for (const [k, t] of seen) if (now - t > ttlS) seen.delete(k); },
    get size() { return seen.size; },
  };
}
const replayKey = (h) => `${h.id}:${h.t}:${h.type}`;

/** Bytes que cubre la firma: la trama con el nibble de saltos a cero. */
export function signedPortion(frame) {
  const c = new Uint8Array(frame.slice(0, HAZARD_BYTES));
  c[0] = c[0] & 0xf0;
  return c;
}
export async function keyFingerprint(publicKey) {
  const raw = new Uint8Array(await subtle.exportKey('raw', publicKey));
  return new Uint8Array(await subtle.digest('SHA-256', raw)).slice(0, 4);
}
const hex = (u8) => [...u8].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function createFrameSigner() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { ...kp, keyId: hex(await keyFingerprint(kp.publicKey)) };
}
/** Cápsula = trama (24) ‖ huella de clave (4) ‖ firma P-256 (64). */
export async function signHazardCapsule(frame, signer) {
  if (!(frame instanceof Uint8Array) || frame.length !== HAZARD_BYTES) throw new Error('cápsula: trama de 24 bytes requerida');
  decodeHazard(frame); // valida antes de firmar
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.privateKey, signedPortion(frame)));
  const out = new Uint8Array(CAPSULE_BYTES);
  out.set(frame, 0); out.set(await keyFingerprint(signer.publicKey), HAZARD_BYTES); out.set(sig, HAZARD_BYTES + 4);
  return out;
}
/** Un relé de cápsula solo cambia el nibble de saltos; la firma sigue siendo válida. */
export function relayCapsule(capsule, { maxHops = 3 } = {}) {
  if (!(capsule instanceof Uint8Array) || capsule.length !== CAPSULE_BYTES) return null;
  const hops = capsule[0] & 15; if (hops >= maxHops) return null;
  const out = new Uint8Array(capsule); out[0] = (out[0] & 0xf0) | (hops + 1); return out;
}

/**
 * Almacén de confianza: claves inscritas con rol, vigencia y revocación.
 * role: 'PEER_DEVICE' (móvil inscrito) | 'AUTHORITY' (centro de tráfico, Guardia Civil, gestor de vía).
 */
export function createTrustStore() {
  const keys = new Map();
  return {
    async enroll(publicKey, { role, label = '', validUntilS = Infinity }) {
      if (!['PEER_DEVICE', 'AUTHORITY'].includes(role)) throw new Error('rol de clave desconocido');
      const keyId = hex(await keyFingerprint(publicKey)); keys.set(keyId, { publicKey, role, label, validUntilS, revoked: false }); return keyId;
    },
    revoke(keyId) { const k = keys.get(keyId); if (k) k.revoked = true; },
    get(keyId) { return keys.get(keyId) ?? null; },
  };
}

/**
 * Evalúa una trama (24 bytes) o una cápsula firmada (92 bytes) recibida.
 * @param {Uint8Array} bytes
 * @param {{ now:number, receiver?:{lat:number,lon:number}, replayCache?:any, trustStore?:any, policy?:object }} ctx
 */
export async function assessHazardFrame(bytes, { now, receiver = null, replayCache = null, trustStore = null, policy = {} } = {}) {
  const P = { ...FRAME_POLICY, ...policy }, reasons = [];
  const res = (trust, extra = {}) => ({ trust, presentationCeiling: PRESENTATION_CEILING[trust] ?? 'NONE', canTriggerCritical: false, reasons, ...extra });
  if (!Number.isFinite(now)) { reasons.push('sin reloj del receptor'); return res('REJECT_CLOCK'); }
  if (!(bytes instanceof Uint8Array) || (bytes.length !== HAZARD_BYTES && bytes.length !== CAPSULE_BYTES)) { reasons.push('longitud no válida'); return res('REJECT_MALFORMED'); }
  const frame = bytes.subarray(0, HAZARD_BYTES);
  let h;
  try { h = decodeHazard(new Uint8Array(frame)); } catch (e) { reasons.push(e.message); return res('REJECT_MALFORMED'); }
  if (h.kind === 'UNKNOWN') { reasons.push(`tipo ${h.type} desconocido`); return res('REJECT_UNKNOWN_TYPE', { hazard: h }); }
  const age = now - h.t;
  if (age < -P.maxFutureS) { reasons.push(`hora futura (${-age} s)`); return res('REJECT_CLOCK', { hazard: h }); }
  if (age > P.maxAgeS) { reasons.push(`caducada (${age} s > ${P.maxAgeS} s)`); return res('REJECT_STALE', { hazard: h }); }
  if (h.speedMs > P.maxVehicleSpeedMs) { reasons.push(`velocidad implausible ${h.speedMs} m/s`); return res('REJECT_IMPLAUSIBLE', { hazard: h }); }
  if (h.decelMs2 > P.maxDecelMs2) { reasons.push(`deceleración implausible ${h.decelMs2} m/s²`); return res('REJECT_IMPLAUSIBLE', { hazard: h }); }
  if (receiver && Number.isFinite(receiver.lat) && Number.isFinite(receiver.lon)) {
    // alcance máximo creíble: radio por salto + lo que el receptor pudo avanzar desde la emisión
    const d = distM(receiver, h), maxD = (h.hops + 1) * P.radioRangeM + Math.max(0, age) * P.maxVehicleSpeedMs;
    if (d > maxD) { reasons.push(`posición implausible: ${Math.round(d)} m > ${Math.round(maxD)} m`); return res('REJECT_IMPLAUSIBLE', { hazard: h, distanceM: Math.round(d) }); }
  } else reasons.push('sin posición del receptor: plausibilidad geográfica no comprobada');

  let trust = 'UNVERIFIED_PEER_HINT', keyId = null, role = null;
  if (bytes.length === CAPSULE_BYTES) {
    keyId = hex(bytes.subarray(HAZARD_BYTES, HAZARD_BYTES + 4));
    const k = trustStore?.get(keyId);
    if (!k) reasons.push('clave no inscrita: se trata como no firmada');
    else if (k.revoked || now > k.validUntilS) { reasons.push('clave revocada o caducada'); return res('REJECT_REVOKED_KEY', { hazard: h, keyId }); }
    else {
      const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, bytes.subarray(HAZARD_BYTES + 4), signedPortion(frame));
      if (!ok) { reasons.push('firma no válida'); return res('REJECT_BAD_SIGNATURE', { hazard: h, keyId }); }
      role = k.role; trust = k.role === 'AUTHORITY' ? 'AUTHORITY_VERIFIED' : 'SIGNED_PEER';
    }
  }
  const key = replayKey(h);
  if (replayCache) {
    if (replayCache.has(key, now)) { reasons.push('evento ya recibido (repetición o relé)'); return res('DUPLICATE', { hazard: h, keyId }); }
    replayCache.add(key, now);
  } else reasons.push('sin caché de repetición: no se detectan duplicados');
  return { ...res(trust, { hazard: { ...h, authenticated: trust !== 'UNVERIFIED_PEER_HINT' }, keyId, role }), canTriggerCritical: false, eventKey: key };
}
