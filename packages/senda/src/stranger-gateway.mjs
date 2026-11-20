/**
 * SENDA · Pasarela de un desconocido («mi hermano no tiene datos, pero alguien a su lado sí»).
 *
 * Problema: WhatsApp, Instagram o el correo necesitan que TU teléfono tenga datos o Wi-Fi. Si no los
 * tiene, no sale nada, aunque a diez metros haya una persona con 4G, un bar con fibra, un coche con
 * módem o una pasarela LoRa del ayuntamiento. SENDA no habla con esas apps ni las sustituye en el día a
 * día: cuando no hay red, el móvil sin datos descubre por radio de corto alcance a otro móvil SENDA que sí
 * la tiene y que ha aceptado prestar su salida, le entrega el mensaje YA CIFRADO y ese desconocido lo sube
 * a un buzón. El desconocido no puede leerlo, no sabe a quién va y no puede hacerse pasar por nadie.
 *
 * Piezas (todas comprobables con pruebas):
 *  1. BALIZA de 18 bytes: «tengo salida (tipo/calidad), batería, cuota que regalo, acepto SOS/personal».
 *     Lleva un identificador EFÍMERO que rota (HMAC del secreto de la pasarela y la ranura de tiempo):
 *     nadie puede seguir a quien presta su conexión.
 *  2. BUZÓN CEGADO: el buzón del destinatario es HMAC(secreto de la pareja, destinatario, día). Cambia
 *     cada día y solo la pareja sabe calcularlo: la pasarela y el servidor ven un número aleatorio.
 *  3. SOBRE EXTERIOR: el sobre E2E (envelope.mjs, firmado y cifrado) se vuelve a cifrar con una clave de la
 *     pareja ligada al buzón. La pasarela ve bytes aleatorios: ni siquiera la cabecera del sobre interior.
 *  4. SELLO DE TRABAJO (hashcash): quien pide prestada la conexión resuelve un pequeño cálculo ligado a ESA
 *     pasarela y a ESA ranura de tiempo; la pasarela lo comprueba con un solo hash. Frena el abuso masivo
 *     sin cuentas ni identidad. La dificultad la DECLARA quien presta la conexión (con menos bits para SOS).
 *  5. RECIBO DE CUSTODIA firmado (ECDSA P-256, clave efímera de la pasarela): «acepté este blob para este
 *     buzón a esta hora». Si no llega el recibo de entrega extremo a extremo a tiempo, el móvil reintenta
 *     por otra pasarela. Es el «✓» del chat: alguien lo lleva.
 *  6. REPARTO k-de-n ENTRE DESCONOCIDOS: el blob se trocea con Reed-Solomon (erasure.mjs) y cada pasarela
 *     recibe fragmentos distintos. Ninguna pasarela sola puede bloquear el mensaje; la probabilidad de
 *     entrega es EXACTA (Poisson-binomial agrupada, bearers.mjs) y con fallos de causa común (todas las
 *     pasarelas colgadas de la misma antena) se calcula por mezcla exacta de estados.
 *  7. FÍSICA DEL DESCUBRIMIENTO: alcance por presupuesto de enlace (pérdida en espacio libre + exponente
 *     de trayecto declarado), tiempo medio de descubrimiento BLE (aproximación de primer orden) y
 *     número de pasarelas al alcance como proceso de Poisson espacial: P(≥1) = 1 − e^(−ρ·φ·π·r²).
 *  8. BAJADA con señuelos: para recoger, la pasarela pide el buzón real mezclado con d buzones señuelo;
 *     sin más información, la pasarela acierta cuál es el real con probabilidad 1/(d+1).
 *
 * Reglas de veracidad (CLAUDE.md): ningún parámetro de campo tiene valor por defecto. Densidades, fracción
 * de personas con SENDA y datos, potencias de radio, exponentes de trayecto y probabilidades por tipo de
 * salida se DECLARAN; EXAMPLE_VILLAGE es un escenario de ejemplo sin fuente, rotulado como tal.
 * Legalidad: la persona que presta su conexión usa SU plan de datos con SU consentimiento explícito y una
 * cuota que ella fija; no se usa ninguna red ajena que no ofrezca ese servicio.
 */
import { sha256Bytes } from './sovereign-mesh-kit.mjs';
import { deliveryProbability } from './bearers.mjs';
import { encodeShards, decodeShards } from './erasure.mjs';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const need = (name, o, keys) => { for (const k of keys) if (!fin(o?.[k])) throw new Error(`${name}: «${k}» debe declararse (sin valor por defecto)`); };

/* ───────────────────────── 1. Baliza ───────────────────────── */

export const UPLINK_KINDS = Object.freeze(['NONE', 'CELL', 'WIFI', 'SAT', 'LORA_GW', 'VEHICLE']);
export const BEACON_BYTES = 18;
const FLAG = { SOS: 1, PERSONAL: 2, FETCH: 4 };

/** Identificador efímero de 8 B: HMAC-SHA-256(secreto de la pasarela, «beacon|ranura»). */
export async function ephemeralId(gatewaySecret, slot) {
  const k = await subtle.importKey('raw', gatewaySecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, te.encode(`beacon|${slot}`))).subarray(0, 8);
}

/**
 * Baliza: [ver][flags][tipo<<4|calidad][batería %][cuota KB (2)][ranura (4)][id efímero (8)] = 18 B.
 * Cabe en los 24 B de datos de fabricante de un anuncio BLE «legacy» de 31 B (31 − 3 de flags − 4 de cabecera).
 */
export function encodeBeacon({ ephId, slot, uplink, quality, batteryPct, quotaKB, accepts = {} }) {
  const kind = UPLINK_KINDS.indexOf(uplink);
  if (kind < 0) throw new Error(`tipo de salida desconocido: ${uplink}`);
  if (!(ephId instanceof Uint8Array) || ephId.length !== 8) throw new Error('ephId: 8 bytes');
  if (!(Number.isInteger(quality) && quality >= 0 && quality <= 15)) throw new RangeError('calidad 0–15');
  if (!(Number.isInteger(slot) && slot >= 0 && slot < 2 ** 32)) throw new RangeError('ranura uint32');
  const b = new Uint8Array(BEACON_BYTES);
  b[0] = 1;
  b[1] = (accepts.sos ? FLAG.SOS : 0) | (accepts.personal ? FLAG.PERSONAL : 0) | (accepts.fetch ? FLAG.FETCH : 0);
  b[2] = (kind << 4) | quality;
  b[3] = Math.max(0, Math.min(100, Math.round(batteryPct)));
  const q = Math.max(0, Math.min(0xffff, Math.floor(quotaKB))); b[4] = q >> 8; b[5] = q & 0xff;
  new DataView(b.buffer).setUint32(6, slot);
  b.set(ephId, 10);
  return b;
}
export function decodeBeacon(b) {
  if (!(b instanceof Uint8Array) || b.length !== BEACON_BYTES || b[0] !== 1) return null;
  const kind = UPLINK_KINDS[b[2] >> 4]; if (!kind) return null;
  return {
    accepts: { sos: !!(b[1] & FLAG.SOS), personal: !!(b[1] & FLAG.PERSONAL), fetch: !!(b[1] & FLAG.FETCH) },
    uplink: kind, quality: b[2] & 15, batteryPct: b[3], quotaKB: (b[4] << 8) | b[5],
    slot: new DataView(b.buffer, b.byteOffset).getUint32(6), ephId: hex(b.subarray(10, 18)),
  };
}

/* ───────────────────────── 2–3. Buzón cegado y sobre exterior ───────────────────────── */

/**
 * Secreto de buzón de la pareja (32 B), simétrico: ECDH P-256 + HKDF con sal = huella de ambas claves
 * ordenadas. Las dos personas lo calculan igual tras escanear el QR de la otra (como en courier.mjs).
 */
export async function deriveMailboxSecret(myPrivateKey, myPublicJwk, peerPublicJwk) {
  const peer = await subtle.importKey('jwk', peerPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: peer }, myPrivateKey, 256);
  const ids = [`${myPublicJwk.x}.${myPublicJwk.y}`, `${peerPublicJwk.x}.${peerPublicJwk.y}`].sort().join('|');
  const salt = new Uint8Array(await subtle.digest('SHA-256', te.encode(ids)));
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('senda-mailbox/v1') }, hk, 256));
}

/** Buzón del día para un destinatario: 16 B hex. Rota a medianoche UTC; nadie fuera de la pareja lo enlaza. */
export async function mailboxId(secret, recipientTag, dayIndex) {
  if (!Number.isInteger(dayIndex)) throw new RangeError('dayIndex entero (días desde 1970 UTC)');
  const k = await subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await subtle.sign('HMAC', k, te.encode(`mbox|${recipientTag}|${dayIndex}`))).subarray(0, 16));
}
export const dayIndexOf = (ms) => Math.floor(ms / 86_400_000);

async function outerKey(secret) {
  const hk = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('senda-outer/v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** Sobre exterior: [iv 12][AES-256-GCM(bytes), AAD = buzón]. La pasarela solo ve bytes aleatorios. */
export async function sealOuter(secret, mbox, bytes) {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: unhex(mbox) }, await outerKey(secret), bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
export async function openOuter(secret, mbox, blob) {
  try {
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12), additionalData: unhex(mbox) }, await outerKey(secret), blob.subarray(12)));
  } catch { return null; }
}

/* ───────────────────────── 4. Sello de trabajo ───────────────────────── */

const leadingZeroBits = (h) => { let z = 0; for (const x of h) { if (x === 0) { z += 8; continue; } return z + Math.clz32(x) - 24; } return z; };
const stampInput = (blobDigest, ephIdHex, slot, nonce) => te.encode(`${blobDigest}|${ephIdHex}|${slot}|${nonce}`);
export const blobDigest = (blob) => hex(sha256Bytes(blob));

/**
 * Dificultad (bits) que pide una pasarela: base + 1 bit por cada `bytesPerExtraBit` (redondeo hacia arriba),
 * o `sosBits` si el sobre es SOS. Coste esperado para quien pide: 2^bits hashes; para la pasarela: 1 hash.
 */
export function stampBits(policy, { bytes, sos }) {
  need('stampBits', policy, ['baseBits', 'sosBits', 'bytesPerExtraBit']);
  return sos ? policy.sosBits : policy.baseBits + Math.ceil(bytes / policy.bytesPerExtraBit);
}
/** Busca un nonce con ≥ bits ceros iniciales en SHA-256(digest|pasarela|ranura|nonce). */
export function mintStamp(blobDigestHex, ephIdHex, slot, bits, { maxTries = 2 ** 26 } = {}) {
  for (let nonce = 0; nonce < maxTries; nonce++) if (leadingZeroBits(sha256Bytes(stampInput(blobDigestHex, ephIdHex, slot, nonce))) >= bits) return { nonce, tries: nonce + 1, bits };
  throw new Error('sello no encontrado dentro del límite');
}
export const verifyStamp = (blobDigestHex, ephIdHex, slot, bits, nonce) => leadingZeroBits(sha256Bytes(stampInput(blobDigestHex, ephIdHex, slot, nonce))) >= bits;

/* ───────────────────────── 5. La pasarela: consentimiento, cuota y recibo ───────────────────────── */

/**
 * Política de quien presta su conexión. TODO se declara: consentimiento, cuota por hora, batería mínima,
 * tamaño máximo por blob y dificultad del sello. Sin consentimiento, la pasarela no anuncia nada.
 */
export function createGatewayPolicy(p) {
  if (p?.consent !== true) return Object.freeze({ consent: false });
  need('createGatewayPolicy', p, ['maxKBPerHour', 'minBatteryPct', 'maxBlobBytes', 'baseBits', 'sosBits', 'bytesPerExtraBit']);
  return Object.freeze({ consent: true, acceptSOS: p.acceptSOS !== false, acceptPersonal: p.acceptPersonal === true, maxKBPerHour: p.maxKBPerHour, minBatteryPct: p.minBatteryPct, maxBlobBytes: p.maxBlobBytes, baseBits: p.baseBits, sosBits: p.sosBits, bytesPerExtraBit: p.bytesPerExtraBit });
}

const canon = (o) => te.encode(JSON.stringify([o.v, o.mbox, o.digest, o.at, o.gw, o.uplink]));

/**
 * Pasarela de un desconocido. `uplink(mbox, blob)` sube el blob a un buzón (relé SENDA, correo, relé público…)
 * y devuelve true si lo aceptó el otro extremo. Clave de firma EFÍMERA por instancia: el recibo no identifica
 * a la persona, solo prueba que esa pasarela aceptó la custodia.
 */
export async function createStrangerGateway({ policy, uplinkKind, quality, gatewaySecret = rand(32), slotSeconds, uplink }) {
  if (!policy?.consent) return { active: false, beacon: async () => null, offer: async () => ({ accepted: false, reason: 'NO_CONSENT' }) };
  need('createStrangerGateway', { slotSeconds, quality }, ['slotSeconds', 'quality']);
  if (typeof uplink !== 'function') throw new Error('uplink(mbox, blob) debe declararse');
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await subtle.exportKey('jwk', kp.publicKey);
  const spent = []; // [{at, bytes}] últimos 3600 s
  const seen = new Set();
  const slotOf = (now) => Math.floor(now / 1000 / slotSeconds);
  const usedLastHour = (now) => { while (spent.length && spent[0].at <= now - 3_600_000) spent.shift(); return spent.reduce((a, s) => a + s.bytes, 0); };
  return {
    active: true, publicKey: pub,
    async beacon(now, batteryPct) {
      if (batteryPct < policy.minBatteryPct) return null; // con poca batería no se ofrece
      const slot = slotOf(now);
      return encodeBeacon({ ephId: await ephemeralId(gatewaySecret, slot), slot, uplink: uplinkKind, quality, batteryPct,
        quotaKB: Math.max(0, policy.maxKBPerHour - usedLastHour(now) / 1024), accepts: { sos: policy.acceptSOS, personal: policy.acceptPersonal, fetch: true } });
    },
    /** @param {{mbox:string, blob:Uint8Array, sos:boolean, slot:number, nonce:number}} req */
    async offer(req, now, batteryPct) {
      const slot = slotOf(now);
      if (batteryPct < policy.minBatteryPct) return { accepted: false, reason: 'LOW_BATTERY' };
      if (req.sos ? !policy.acceptSOS : !policy.acceptPersonal) return { accepted: false, reason: 'KIND_NOT_ACCEPTED' };
      if (!(req.blob instanceof Uint8Array) || req.blob.length > policy.maxBlobBytes) return { accepted: false, reason: 'TOO_BIG' };
      if (req.slot !== slot && req.slot !== slot - 1) return { accepted: false, reason: 'STALE_SLOT' };
      const eph = hex(await ephemeralId(gatewaySecret, req.slot)), digest = blobDigest(req.blob);
      if (seen.has(digest)) return { accepted: false, reason: 'DUPLICATE' };
      if (!verifyStamp(digest, eph, req.slot, stampBits(policy, { bytes: req.blob.length, sos: req.sos }), req.nonce)) return { accepted: false, reason: 'BAD_STAMP' };
      if (usedLastHour(now) + req.blob.length > policy.maxKBPerHour * 1024) return { accepted: false, reason: 'QUOTA' };
      seen.add(digest);
      const ok = await uplink(req.mbox, req.blob);
      if (!ok) return { accepted: false, reason: 'UPLINK_FAILED' };
      spent.push({ at: now, bytes: req.blob.length });
      const body = { v: 1, mbox: req.mbox, digest, at: now, gw: eph, uplink: uplinkKind };
      const sig = hex(new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, canon(body))));
      return { accepted: true, receipt: { ...body, sig, pub } };
    },
  };
}

/** Comprueba un recibo de custodia contra el blob que se entregó. */
export async function verifyCustodyReceipt(receipt, blob) {
  if (receipt?.digest !== blobDigest(blob)) return false;
  const k = await subtle.importKey('jwk', receipt.pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, unhex(receipt.sig), canon(receipt));
}

/** Lado del móvil sin datos: prepara la petición para una baliza concreta (sello ligado a ESA pasarela). */
export function prepareHandoff({ mbox, blob, sos, beacon, policyBits }) {
  const b = typeof beacon.ephId === 'string' ? beacon : decodeBeacon(beacon);
  const { nonce, tries } = mintStamp(blobDigest(blob), b.ephId, b.slot, policyBits);
  return { mbox, blob, sos, slot: b.slot, nonce, tries };
}

/* ───────────────────────── 6. Reparto k-de-n entre desconocidos ───────────────────────── */

export const EXACT_LIMIT = 20_000;

/**
 * Elige pasarelas y reparte n fragmentos (k necesarios) para MAXIMIZAR P(≥k) exacta.
 * candidates: [{id, p, capShards}] con p = P(la pasarela acepta y sube a tiempo) ya descontado el riesgo de
 * que la tire (p = p_enlace·(1 − q_abandono), ambos declarados). Asignación codiciosa por ganancia marginal y
 * búsqueda local por traslado de fragmentos; en instancias pequeñas se compara con el óptimo exacto (exhaustiveAllocation).
 */
export function planShardSpread(candidates, { k, n }) {
  if (!(Number.isInteger(k) && Number.isInteger(n) && k >= 1 && n >= k)) throw new RangeError('1 ≤ k ≤ n enteros');
  for (const c of candidates) if (!(fin(c.p) && c.p >= 0 && c.p <= 1) || !Number.isInteger(c.capShards)) throw new Error(`candidato ${c.id}: p y capShards declarados`);
  const Pof = (al) => deliveryProbability(candidates.map((c, i) => ({ p: c.p, shards: al[i] })).filter((g) => g.shards > 0), k);
  // Objetivo: P(≥k) y, a igualdad (mesetas con P = 0 antes de colocar k fragmentos), más fragmentos esperados.
  const score = (al) => Pof(al) + 1e-9 * al.reduce((acc, s, i) => acc + s * candidates[i].p, 0);
  const capTotal = candidates.reduce((a, c) => a + c.capShards, 0), N = Math.min(n, capTotal);
  const localSearch = (al) => { // traslados y vaciados de pasarelas hasta un óptimo local
    for (let guard = 0; guard < 500; guard++) {
      const base = score(al); let moved = false;
      for (let i = 0; i < al.length && !moved; i++) for (let j = 0; j < al.length && !moved; j++) {
        for (let q = 1; q <= al[i]; q++) { // traslados de q fragmentos de i a j (vaciar una pasarela entera incluido)
          if (i === j || al[j] + q > candidates[j].capShards) continue;
          al[i] -= q; al[j] += q;
          if (score(al) > base + 1e-15) { moved = true; break; }
          al[i] += q; al[j] -= q;
        }
      }
      if (!moved) return al;
    }
    return al;
  };
  // Arranques: (a) codicioso por ganancia marginal, (b) llenar las pasarelas por p decreciente, (c) reparto uniforme.
  const greedy = candidates.map(() => 0);
  for (let s = 0; s < N; s++) {
    let best = -1, bestV = -1;
    for (let i = 0; i < candidates.length; i++) { if (greedy[i] >= candidates[i].capShards) continue; greedy[i]++; const v = score(greedy); greedy[i]--; if (v > bestV) { bestV = v; best = i; } }
    greedy[best]++;
  }
  const fill = candidates.map(() => 0); { let left = N; for (const i of candidates.map((c, i) => i).sort((x, y) => candidates[y].p - candidates[x].p)) { const t = Math.min(left, candidates[i].capShards); fill[i] = t; left -= t; } }
  const even = candidates.map(() => 0); for (let s = 0, i = 0; s < N; i = (i + 1) % candidates.length) if (even[i] < candidates[i].capShards) { even[i]++; s++; }
  // Si el número de repartos posibles es manejable, se enumeran todos (óptimo EXACTO); si no, multiarranque +
  // búsqueda local (HEURÍSTICO; en 1500 instancias aleatorias pequeñas la brecha media frente al óptimo fue 0,001
  // y la máxima 0,17 en un caso k = n: por eso se usa el exacto siempre que se puede).
  const count = (() => { let ways = new Array(N + 1).fill(0); ways[0] = 1; for (const c of candidates) { const nx = new Array(N + 1).fill(0); for (let t = 0; t <= N; t++) if (ways[t]) for (let s = 0; s <= c.capShards && t + s <= N; s++) nx[t + s] += ways[t]; ways = nx; } return ways[N]; })();
  let method, alloc;
  if (count <= EXACT_LIMIT) {
    method = 'EXACT';
    const ex = exhaustiveAllocation(candidates, { k, n: N });
    const by = new Map(ex.allocation.map((a) => [a.id, a.shards])); alloc = candidates.map((c) => by.get(c.id) ?? 0);
  } else {
    method = 'HEURISTIC';
    alloc = [greedy, fill, even].map((al) => localSearch([...al])).reduce((m, al) => (score(al) > score(m) ? al : m));
  }
  const P = () => Pof(alloc);
  const used = alloc.reduce((a, b) => a + b, 0);
  const single = candidates.reduce((m, c) => (c.capShards >= k && c.p > m.p ? { id: c.id, p: c.p } : m), { id: null, p: 0 });
  return { k, n: used, method, alternatives: count, allocation: candidates.map((c, i) => ({ id: c.id, shards: alloc[i] })).filter((a) => a.shards), pDelivery: used >= k ? P() : 0, bestSingleGateway: single };
}

/** Óptimo exacto por enumeración (solo instancias pequeñas): referencia para medir la brecha de planShardSpread. */
export function exhaustiveAllocation(candidates, { k, n }) {
  let best = { p: -1, alloc: null };
  const rec = (i, left, alloc) => {
    if (i === candidates.length) {
      if (left !== 0) return;
      const p = deliveryProbability(candidates.map((c, j) => ({ p: c.p, shards: alloc[j] })).filter((g) => g.shards), k);
      if (p > best.p) best = { p, alloc: [...alloc] };
      return;
    }
    for (let s = 0; s <= Math.min(left, candidates[i].capShards); s++) { alloc[i] = s; rec(i + 1, left - s, alloc); }
  };
  rec(0, n, []);
  return { pDelivery: best.p, allocation: candidates.map((c, i) => ({ id: c.id, shards: best.alloc?.[i] ?? 0 })).filter((a) => a.shards) };
}

/**
 * Fallo de causa común: todas las pasarelas de un mismo tipo de salida dependen de lo mismo (la antena del
 * pueblo, el repetidor Wi-Fi…). commonCause = { CELL: P(antena viva), … } (declarado). Mezcla EXACTA sobre
 * los 2^K estados de los K tipos con causa común; dentro de cada estado, Poisson-binomial exacta.
 */
export function spreadProbabilityCommonCause(candidates, allocation, k, commonCause) {
  const kinds = Object.keys(commonCause);
  for (const kd of kinds) if (!(fin(commonCause[kd]) && commonCause[kd] >= 0 && commonCause[kd] <= 1)) throw new Error(`commonCause.${kd} ∈ [0,1]`);
  const by = new Map(allocation.map((a) => [a.id, a.shards]));
  let total = 0;
  for (let mask = 0; mask < 2 ** kinds.length; mask++) {
    let w = 1; const up = {};
    kinds.forEach((kd, i) => { const on = !!(mask & (1 << i)); up[kd] = on; w *= on ? commonCause[kd] : 1 - commonCause[kd]; });
    if (w === 0) continue;
    const groups = candidates.filter((c) => by.get(c.id)).map((c) => ({ p: kinds.includes(c.uplink) && !up[c.uplink] ? 0 : c.p, shards: by.get(c.id) }));
    total += w * deliveryProbability(groups, k);
  }
  return total;
}

/* ───────────────────────── 7. Física del descubrimiento ───────────────────────── */

/** Pérdida en espacio libre (dB): 20·log10(d) + 20·log10(f) − 147,55 (d en m, f en Hz). */
export const fsplDb = (dM, fHz) => 20 * Math.log10(dM) + 20 * Math.log10(fHz) - 147.55;

/**
 * Alcance (m) con modelo log-distancia: PL(d) = FSPL(1 m) + 10·n·log10(d) + pérdidas extra.
 * Todo declarado: potencia, sensibilidad, frecuencia, exponente n (2 en espacio libre; mayor en interior).
 */
export function linkRangeM(p) {
  need('linkRangeM', p, ['txDbm', 'rxSensitivityDbm', 'fHz', 'pathLossExponent', 'extraLossDb']);
  const budget = p.txDbm - p.rxSensitivityDbm - p.extraLossDb - fsplDb(1, p.fHz);
  return budget <= 0 ? 0 : 10 ** (budget / (10 * p.pathLossExponent));
}

/**
 * Tiempo medio de descubrimiento BLE, aproximación de primer orden: cada anuncio (cada advIntervalS) cae dentro
 * de una ventana de escucha con probabilidad d = scanWindowS/scanIntervalS ⇒ intentos geométricos ⇒
 * E[T] ≈ advIntervalS / d. Ignora el salto entre los 3 canales y el retardo aleatorio de 0–10 ms del estándar.
 */
export function bleDiscoveryMeanS(p) {
  need('bleDiscoveryMeanS', p, ['advIntervalS', 'scanWindowS', 'scanIntervalS']);
  const d = Math.min(1, p.scanWindowS / p.scanIntervalS);
  return { meanS: p.advIntervalS / d, pPerAdvert: d, basis: 'APROXIMACION_PRIMER_ORDEN' };
}

/**
 * Pasarelas al alcance como proceso de Poisson espacial de intensidad ρ·φ (personas/km² × fracción con SENDA,
 * datos y consentimiento): λ = ρ·φ·π·r²; P(≥1 ahora) = 1 − e^(−λ). Moviéndose a v respecto a ellas, nuevas
 * pasarelas entran en el círculo a ritmo 2·r·v·ρ·φ (barrido de una franja de anchura 2r).
 */
export function gatewayAvailability(p) {
  need('gatewayAvailability', p, ['densityPerKm2', 'fraction', 'rangeM', 'relSpeedMs']);
  const rho = (p.densityPerKm2 * p.fraction) / 1e6; // por m²
  const lambda = rho * Math.PI * p.rangeM ** 2;
  const ratePerS = 2 * p.rangeM * p.relSpeedMs * rho;
  const pNow = 1 - Math.exp(-lambda);
  const t = (q) => (ratePerS > 0 ? -Math.log(1 - q) / ratePerS : Infinity);
  return { expectedInRange: lambda, pAtLeastOneNow: pNow, newGatewaysPerHour: ratePerS * 3600,
    meanWaitIfNoneS: ratePerS > 0 ? 1 / ratePerS : Infinity, wait90IfNoneS: t(0.9), basis: 'POISSON_ESPACIAL' };
}

/* ───────────────────────── 8. Bajada con señuelos ───────────────────────── */

/** Lista de buzones a pedir: los reales mezclados con `decoys` aleatorios por cada real (Fisher–Yates). */
export function planFetch(realMboxes, { decoys }) {
  if (!(Number.isInteger(decoys) && decoys >= 0)) throw new RangeError('decoys entero ≥ 0 (declarado)');
  const all = [...realMboxes, ...Array.from({ length: realMboxes.length * decoys }, () => hex(rand(16)))];
  for (let i = all.length - 1; i > 0; i--) { const j = rand(1)[0] % (i + 1); [all[i], all[j]] = [all[j], all[i]]; }
  return { request: all, pGatewayGuessesReal: 1 / (decoys + 1), extraBytesFactor: decoys + 1 };
}

/* ───────────────────────── 9. Simulación de extremo a extremo (Monte Carlo) ───────────────────────── */

export const EXAMPLE_VILLAGE = Object.freeze({
  basis: 'EJEMPLO_DECLARADO · fuente no verificada; sustituir por datos del municipio',
  densityPerKm2: 60, fraction: 0.05, rangeM: 40, relSpeedMs: 1.2, pHandoff: 0.8, k: 3, n: 6, shardsPerGateway: 2,
});

function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * El móvil sin datos espera pasarelas (las que ya están al alcance + llegadas de Poisson) y entrega a cada una
 * `shardsPerGateway` fragmentos distintos; cada entrega sale bien con pHandoff. Mensaje entregado cuando hay ≥ k
 * fragmentos subidos. Devuelve cuantiles del tiempo hasta salir a Internet.
 */
export function simulateStrangerRelay(sc, { runs = 2000, seed = 1, horizonS = 6 * 3600 } = {}) {
  need('simulateStrangerRelay', sc, ['densityPerKm2', 'fraction', 'rangeM', 'relSpeedMs', 'pHandoff', 'k', 'n', 'shardsPerGateway']);
  const av = gatewayAvailability(sc), rnd = mulberry32(seed), times = [];
  const rate = 2 * sc.rangeM * sc.relSpeedMs * (sc.densityPerKm2 * sc.fraction) / 1e6;
  const poisson = (l) => { let x = 0, p = Math.exp(-l), s = p; const u = rnd(); while (u > s && x < 1000) { x++; p *= l / x; s += p; } return x; };
  for (let r = 0; r < runs; r++) {
    let t = 0, next = 0; const delivered = new Set();
    // cada pasarela recibe los siguientes fragmentos en turno rotatorio (si se agotan los n, se reenvían los que falten)
    const visit = () => {
      const pending = [...Array(sc.n).keys()].filter((i) => !delivered.has(i));
      const give = []; for (let j = 0; j < Math.min(sc.shardsPerGateway, pending.length); j++) give.push(pending[(next + j) % pending.length]);
      next += give.length;
      if (rnd() < sc.pHandoff) for (const i of give) delivered.add(i);
      return delivered.size >= sc.k;
    };
    let done = false;
    for (let i = poisson(av.expectedInRange); i > 0 && !done; i--) done = visit();
    while (!done) { t += rate > 0 ? -Math.log(1 - rnd()) / rate : Infinity; if (!(t < horizonS)) break; done = visit(); }
    times.push(done ? t : Infinity);
  }
  times.sort((a, b) => a - b);
  const q = (x) => times[Math.min(runs - 1, Math.floor(x * runs))];
  return { basis: 'SIMULACION', runs, seed, pWithinHorizon: times.filter((x) => x < Infinity).length / runs, p50S: q(0.5), p90S: q(0.9), availability: av };
}

/* ───────────────────────── Demostración completa en memoria ───────────────────────── */

/**
 * Trocea un blob exterior en n fragmentos k-de-n (cada uno se sella aparte para la pasarela que lo lleva)
 * y lo recompone en el otro lado. Formato de fragmento: [k][n][índice][len(2)][datos].
 */
export function splitForGateways(blob, k, n) {
  const enc = encodeShards(blob, k, n);
  return enc.shards.map((d, i) => { const o = new Uint8Array(5 + d.length); o[0] = k; o[1] = n; o[2] = i; o[3] = blob.length >> 8; o[4] = blob.length & 0xff; o.set(d, 5); return o; });
}
export function joinFromGateways(pieces) {
  if (!pieces.length) return null;
  const k = pieces[0][0], len = (pieces[0][3] << 8) | pieces[0][4];
  const rec = pieces.map((p) => ({ index: p[2], data: p.subarray(5) }));
  if (new Set(rec.map((r) => r.index)).size < k) return null;
  return decodeShards(rec, { k, len });
}
