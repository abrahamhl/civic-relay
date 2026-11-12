/**
 * SENDA · Correo sin red entre países («el mensaje a mi hermano»).
 *
 * Caso: tú en España, tu hermano en Holanda, los dos sin cobertura ni Internet y sin nadie con SENDA en
 * medio. Nada viaja por arte de magia 1.500 km: el mensaje necesita llegar a UN punto con Internet en tu
 * lado (la «primera milla»), cruzar Internet (segundos) y salir de Internet en el lado de tu hermano (la
 * «última milla»). Este módulo planifica y simula esas tres etapas con TODAS las vías legales a la vez:
 *
 *  1. El cuerpo se cifra UNA vez (envelope.mjs, extremo a extremo): nadie en medio lo puede leer.
 *  2. Ese sobre se trocea con Reed-Solomon k-de-n (erasure.mjs) en fragmentos del tamaño que admite el
 *     canal más estrecho (51 B en LoRaWAN). Cada fragmento puede ir por una vía distinta y en momentos
 *     distintos: en cuanto llegan k cualesquiera, el sobre se rehace exacto. La «forma» cambia en cada
 *     salto (binario, texto SMS, LoRa…); la esencia (el sobre cifrado y firmado) no cambia nunca.
 *  3. En Internet, cada fragmento se deja en VARIOS buzones independientes (relé SENDA, correo del
 *     hermano, relés públicos tipo Nostr): basta con que funcione uno.
 *  4. El teléfono de tu hermano los recoge por la primera vía que tenga (pasarela LoRaWAN, mensajero
 *     satelital, una antena que vuelve, un vecino con SENDA…).
 *
 * Qué NO se hace (y por qué): usar dispositivos ajenos que no ofrecen ese servicio (p. ej. difundir datos
 * por las redes de localización de Apple/Google como en la investigación «Send My» de 2021) vulnera sus
 * condiciones de uso y no se puede ofrecer a un Estado. Sí es legítimo usar redes PÚBLICAS diseñadas para
 * llevar datos de cualquiera que se registre (LoRaWAN comunitario, Meshtastic con pasarela MQTT) y
 * servicios contratados (satélite). Esas vías llevan `status` y fuente; las cifras marcadas HIPÓTESIS se
 * sustituyen por lo medido (`docs/research/MENSAJE_SIN_RED_ES_NL_2026-11.md`).
 */
import { encodeShards, packShard, createReassembler, SHARD_HEADER } from './erasure.mjs';
import { rng } from './incident-ops.mjs';

/**
 * Tiempo en el aire de una trama LoRa (Semtech AN1200.13): BW 125 kHz, CR 4/5, preámbulo 8, cabecera
 * explícita, CRC; optimización de baja velocidad en SF11/SF12. `payloadBytes` = PHYPayload completo.
 */
export function loraAirtimeMs(payloadBytes, sf, { bwHz = 125_000, cr = 1, preamble = 8, explicitHeader = true, crc = true } = {}) {
  if (!(sf >= 7 && sf <= 12)) throw new RangeError('SF entre 7 y 12');
  const tSym = (2 ** sf) / bwHz * 1000, de = sf >= 11 ? 1 : 0, ih = explicitHeader ? 0 : 1;
  const nPayload = 8 + Math.max(Math.ceil((8 * payloadBytes - 4 * sf + 28 + 16 * (crc ? 1 : 0) - 20 * ih) / (4 * (sf - 2 * de))) * (cr + 4), 0);
  return (preamble + 4.25) * tSym + nPayload * tSym;
}
/** LoRaWAN añade 13 B de cabecera (MHDR 1 + FHDR 7 + FPort 1 + MIC 4) a la carga útil. */
export const LORAWAN_OVERHEAD = 13;

/**
 * Vías por las que puede salir o entrar un fragmento. dir: FIRST (de ti a Internet), LAST (de Internet a
 * tu hermano) o BOTH. pAvail = probabilidad de que la vía exista en ese país y lugar; meanWaitMin = espera
 * media hasta una oportunidad de envío cuando existe; perDay = fragmentos al día que admite.
 */
export const COURIER_LEGS = Object.freeze({
  QUEUE_CELL: { label: 'Cola en el móvil hasta que vuelva cualquier cobertura', dir: 'BOTH', hardware: null, mtu: 1 << 16, status: 'VERIFIED_BEHAVIOUR', note: 'Siempre activa: es la vía de referencia («esperar a que vuelva la red»).' },
  SENDA_NEIGHBOUR: { label: 'Vecino con SENDA (Bluetooth/Wi-Fi) que tenga Internet o lo encuentre', dir: 'BOTH', hardware: null, mtu: 4096, status: 'HYPOTHESIS', pAvail: { ES: 0.15, NL: 0.15 }, meanWaitMin: 90, perDay: 500, note: 'Crece con la adopción; hoy casi nula.' },
  OPEN_WIFI: { label: 'Wi-Fi público abierto que siga con Internet (biblioteca, estación)', dir: 'BOTH', hardware: null, mtu: 1 << 16, status: 'HYPOTHESIS', pAvail: { ES: 0.2, NL: 0.25 }, meanWaitMin: 240, perDay: 10_000, note: 'Hay que desplazarse; en un apagón regional muchas caen.' },
  LORAWAN_PUBLIC: { label: 'Módulo LoRaWAN propio (Bluetooth al móvil) → pasarela comunitaria (The Things Network/Helium)', dir: 'BOTH', hardware: 'Módulo LoRaWAN EU868 con Bluetooth (p. ej. placa ESP32 + SX1262)', mtu: 51, status: 'HYPOTHESIS', pAvail: { ES: 0.35, NL: 0.85 }, sf: { ES: 12, NL: 9 }, airtimeBudgetMsDay: 30_000, downlinksPerDay: 10, meanWaitMin: 2, note: 'Las pasarelas están hechas para llevar datos de cualquier dispositivo registrado: uso previsto, no abuso. Límite de uso justo de TTN: 30 s de aire de subida y 10 bajadas al día por dispositivo.' },
  MESHTASTIC_MQTT: { label: 'Nodo Meshtastic propio → nodo público con pasarela a Internet (MQTT)', dir: 'BOTH', hardware: 'Nodo Meshtastic (ESP32/nRF52 + SX1262)', mtu: 200, status: 'HYPOTHESIS', pAvail: { ES: 0.3, NL: 0.45 }, meanWaitMin: 20, perDay: 200, note: 'Depende de que algún nodo de la zona publique por MQTT.' },
  SAT_MESSENGER: { label: 'Mensajero satelital de bolsillo (Garmin inReach, ZOLEO, Motorola Defy…)', dir: 'BOTH', hardware: 'Mensajero satelital con suscripción', mtu: 116, text: true, status: 'VERIFY_PENDING', pAvail: { ES: 0.97, NL: 0.97 }, meanWaitMin: 10, perDay: 40, costPerMsgEUR: null, note: 'Funciona sin ninguna infraestructura terrestre con cielo despejado. Coste por plan: a verificar.' },
  IRIDIUM_SBD: { label: 'Módem Iridium SBD (RockBLOCK)', dir: 'BOTH', hardware: 'RockBLOCK 9603 + antena', mtu: 324, status: 'VERIFY_PENDING', pAvail: { ES: 0.97, NL: 0.97 }, meanWaitMin: 5, perDay: 100, costPerMsgEUR: null, note: '340 B por mensaje de subida, 270 de bajada; coste por crédito a verificar.' },
  SAT_PHONE_NATIVE: { label: 'Mensajes por satélite del propio móvil (iPhone/Android compatibles)', dir: 'BOTH', hardware: 'Móvil compatible', mtu: 116, text: true, status: 'VERIFY_PENDING', pAvail: { ES: 0, NL: 0 }, meanWaitMin: 5, perDay: 50, note: 'Disponibilidad por país pendiente de verificar: a 0 hasta confirmarla con fuente.' },
  VEHICLE_MULE: { label: 'Coche o autobús con SENDA que lo lleva hasta donde haya cobertura', dir: 'FIRST', hardware: null, mtu: 1 << 16, status: 'HYPOTHESIS', pAvail: { ES: 0.25, NL: 0.25 }, meanWaitMin: 180, perDay: 10_000, note: 'Útil dentro de la zona del apagón; no cruza países por sí solo.' },
  SOUND_HOP: { label: 'Sonido entre dos móviles a ~1 m', dir: 'LOCAL', hardware: null, mtu: 4096, status: 'VERIFIED_CODE', note: 'Solo un salto local (pasar el mensaje a quien sí tenga una vía). Nunca para larga distancia.' },
  APRS: { label: 'APRS (radioaficionado)', dir: 'BOTH', hardware: 'Equipo VHF + licencia', mtu: 46, status: 'EXCLUDED_PRIVATE', note: 'Prohibido cifrar en bandas de aficionado: no sirve para un mensaje privado.' },
  FIND_MY_ABUSE: { label: 'Redes de localización de Apple/Google usadas para llevar datos', dir: 'BOTH', hardware: null, mtu: 0, status: 'PROHIBITED', note: 'Investigación «Send My» (2021): técnicamente posible, pero vulnera las condiciones del servicio. SENDA no lo usa.' },
});

/** Buzones independientes en Internet donde se deja cada fragmento (basta con que funcione uno). */
export const DROPS = Object.freeze({
  SENDA_RELAY: { label: 'Relé SENDA', pUp: 0.98 },
  EMAIL: { label: 'Correo del destinatario (adjunto cifrado)', pUp: 0.99 },
  NOSTR: { label: 'Relés públicos Nostr (3)', pUp: 0.995 },
});

const USABLE = (leg, side) => leg && !['PROHIBITED', 'EXCLUDED_PRIVATE'].includes(leg.status) && (leg.dir === 'BOTH' || leg.dir === side);

/** Fragmentos/día de una vía (en LoRaWAN sale del presupuesto de tiempo en el aire con el SF del país). */
export function legCapacityPerDay(id, country, side) {
  const L = COURIER_LEGS[id];
  if (id === 'LORAWAN_PUBLIC') {
    if (side === 'LAST') return L.downlinksPerDay;
    const ms = loraAirtimeMs(L.mtu + LORAWAN_OVERHEAD, L.sf[country] ?? 12);
    return Math.floor(L.airtimeBudgetMsDay / ms);
  }
  return L.perDay ?? Infinity;
}

/**
 * Plan: qué vías usa cada lado, tamaño de fragmento y k-de-n.
 * @param {{country:'ES'|'NL', has:string[]}} from  `has` = vías disponibles para ti (hardware que tienes)
 * @param {{country:'ES'|'NL', has:string[]}} to
 */
export function planCourier({ envelopeBytes, from, to, redundancy = 1.5 }) {
  const pick = (who, side) => ['QUEUE_CELL', ...who.has].filter((id, i, a) => a.indexOf(id) === i && USABLE(COURIER_LEGS[id], side));
  const first = pick(from, 'FIRST'), last = pick(to, 'LAST');
  const rejected = [...from.has, ...to.has].filter((id) => COURIER_LEGS[id] && !USABLE(COURIER_LEGS[id], 'FIRST') && !USABLE(COURIER_LEGS[id], 'LAST')).map((id) => ({ id, why: COURIER_LEGS[id].note }));
  const mtu = Math.min(...[...first, ...last].map((id) => COURIER_LEGS[id].mtu));
  const shardData = mtu - SHARD_HEADER;
  if (shardData < 8) throw new Error('MTU demasiado pequeña');
  const k = Math.ceil(envelopeBytes / shardData), n = Math.min(255, Math.ceil(k * redundancy));
  return { k, n, shardBytes: shardData + SHARD_HEADER, from, to, first, last, rejected,
    capacity: { first: Object.fromEntries(first.map((id) => [id, legCapacityPerDay(id, from.country, 'FIRST')])), last: Object.fromEntries(last.map((id) => [id, legCapacityPerDay(id, to.country, 'LAST')])) } };
}

const expo = (R, mean) => -Math.log(1 - R()) * mean;

/**
 * Monte Carlo: horas hasta que el hermano tiene k fragmentos. `restoreH` = media (h) hasta que vuelve la
 * red en cada lado (HIPÓTESIS de escenario, la pone quien simula). Devuelve la curva y la comparación con
 * «esperar a que vuelva la red».
 */
export function simulateCourier(plan, { runs = 2000, seed = 1, restoreH = { from: 24, to: 24 }, checkpointsH = [1, 6, 24, 72] } = {}) {
  const R = rng(seed), times = [], base = [];
  for (let r = 0; r < runs; r++) {
    const restFrom = expo(R, restoreH.from), restTo = expo(R, restoreH.to);
    base.push(Math.max(restFrom, restTo)); // sin SENDA: los dos necesitan red
    // primera milla: cada vía disponible sube fragmentos a su ritmo
    const atNet = [];
    for (const id of plan.first) {
      const L = COURIER_LEGS[id];
      if (id === 'QUEUE_CELL') { for (let i = 0; i < plan.n; i++) atNet.push(restFrom); continue; }
      if (!(R() < (L.pAvail?.[plan.from.country] ?? 0))) continue;
      const cap = plan.capacity.first[id], perFrame = Math.max(1, Math.floor(L.mtu / plan.shardBytes));
      let t = expo(R, L.meanWaitMin / 60);
      for (let i = 0; i < plan.n; i += perFrame) { const day = Math.floor((i / perFrame) / cap); for (let j = 0; j < perFrame; j++) atNet.push(t + day * 24); t += expo(R, (L.meanWaitMin / 60) / 4); }
    }
    // Internet: un fragmento queda disponible si algún buzón funciona
    const dropsUp = Object.values(DROPS).some((d) => R() < d.pUp);
    if (!dropsUp) { times.push(Infinity); continue; }
    atNet.sort((a, b) => a - b);
    const distinct = atNet.slice(0, plan.n); // índices distintos: como mucho n
    // última milla: el hermano baja fragmentos por la primera vía que tenga
    let best = Infinity;
    for (const id of plan.last) {
      const L = COURIER_LEGS[id];
      if (id === 'QUEUE_CELL') { if (distinct.length >= plan.k) best = Math.min(best, Math.max(restTo, distinct[plan.k - 1])); continue; }
      if (!(R() < (L.pAvail?.[plan.to.country] ?? 0))) continue;
      const cap = plan.capacity.last[id], perFrame = Math.max(1, Math.floor(L.mtu / plan.shardBytes));
      let t = expo(R, L.meanWaitMin / 60), got = 0, done = Infinity;
      for (let i = 0; i < distinct.length && got < plan.k; i += perFrame) {
        const day = Math.floor((i / perFrame) / cap), ready = distinct[Math.min(distinct.length - 1, i + perFrame - 1)];
        t = Math.max(t, ready) + (L.meanWaitMin / 60) / 4; got += perFrame; if (got >= plan.k) done = t + day * 24;
      }
      best = Math.min(best, done);
    }
    // mezcla: fragmentos que bajan por vías distintas también suman (cota conservadora: la mejor vía sola)
    times.push(best);
  }
  const P = (arr, h) => arr.filter((t) => t <= h).length / arr.length;
  const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return { runs, byHour: Object.fromEntries(checkpointsH.map((h) => [h, { senda: +P(times, h).toFixed(3), waitForNetwork: +P(base, h).toFixed(3) }])), medianH: { senda: +med(times).toFixed(2), waitForNetwork: +med(base).toFixed(2) } };
}

/**
 * Prueba real de extremo a extremo: el sobre ya cifrado se trocea, cada fragmento viaja por una vía
 * distinta (con su propio formato) y algunos se pierden; el destinatario rehace el sobre exacto.
 * @param {Uint8Array} envelope  sobre empaquetado (packEnvelope)
 * @param {{k:number,n:number,shardBytes:number}} plan
 * @param {(index:number)=>string|null} routeOf  vía de cada fragmento o null si se pierde
 */
export function carry(envelope, plan, routeOf, id = globalThis.crypto.getRandomValues(new Uint8Array(8))) {
  const enc = encodeShards(envelope, plan.k, plan.n), re = createReassembler(), log = [];
  let result = null;
  for (let i = 0; i < plan.n && !result; i++) {
    const via = routeOf(i); if (!via) { log.push({ i, via: 'perdido' }); continue; }
    const frame = packShard({ id, k: plan.k, n: plan.n, len: envelope.length, index: i, data: enc.shards[i] });
    if (frame.length > COURIER_LEGS[via].mtu) throw new Error(`${via}: ${frame.length} B > MTU`);
    // cambia la forma en el salto (texto para canales de texto), no el contenido
    const wire = COURIER_LEGS[via].text ? 'SND1 ' + btoa(String.fromCharCode(...frame)) : frame;
    const back = typeof wire === 'string' ? Uint8Array.from(atob(wire.slice(5)), (c) => c.charCodeAt(0)) : wire;
    log.push({ i, via, bytes: frame.length });
    result = re.add(back, via);
  }
  return { envelope: result?.data ?? null, vias: result?.via ?? [], log };
}

/* ───────────── Mensaje compacto entre contactos emparejados (cabe en 2–3 tramas LoRaWAN) ─────────────
 * El sobre general (envelope.mjs) lleva clave efímera y firma: ~300 B de sobrecarga, de sobra para
 * datos móviles pero 2 días de uso justo de LoRaWAN a SF12. Si dos personas se emparejan ANTES (QR en
 * persona o con red: igual que añadir un contacto en una app cifrada), comparten una clave AES-256-GCM
 * derivada por ECDH P-256 + HKDF y cada mensaje solo añade 25 B: versión, id de pareja, secuencia y
 * etiqueta de autenticación. Confidencial, autenticado (solo la pareja puede crearlo) y sin repeticiones.
 */
const te = new TextEncoder(), td = new TextDecoder();
const subtle = globalThis.crypto.subtle;
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Cada persona genera su par de claves de emparejamiento y enseña la pública (JWK) en un QR. */
export async function createPairingKeys() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { privateKey: kp.privateKey, publicJwk: await subtle.exportKey('jwk', kp.publicKey) };
}

/** Clave compartida de la pareja + etiquetas de dirección (cada uno cifra con su propio prefijo de nonce). */
export async function derivePairing(mine, peerPublicJwk) {
  const peer = await subtle.importKey('jwk', peerPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: peer }, mine.privateKey, 256);
  const ids = [JSON.stringify([mine.publicJwk.x, mine.publicJwk.y]), JSON.stringify([peerPublicJwk.x, peerPublicJwk.y])].sort();
  const salt = new Uint8Array(await subtle.digest('SHA-256', te.encode(ids.join('|'))));
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey', 'deriveBits']);
  const key = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('senda-courier-pair/v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const pairId = salt.subarray(0, 4);
  const tag = async (jwk) => new Uint8Array(await subtle.digest('SHA-256', te.encode(`${jwk.x}.${jwk.y}`))).subarray(0, 4);
  return { key, pairId, myTag: await tag(mine.publicJwk), peerTag: await tag(peerPublicJwk), seen: new Set(), seq: 0 };
}

/** Mensaje compacto: [ver=1][pairId 4][seq 4][texto cifrado][etiqueta GCM 16]. */
export async function sealCompact(pair, text) {
  const seq = ++pair.seq, head = new Uint8Array(9); head[0] = 1; head.set(pair.pairId, 1); new DataView(head.buffer).setUint32(5, seq);
  const iv = new Uint8Array(12); iv.set(pair.myTag, 0); iv.set(head.subarray(5, 9), 4);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: head }, pair.key, te.encode(text)));
  const out = new Uint8Array(head.length + ct.length); out.set(head); out.set(ct, head.length); return out;
}

/** Abre un mensaje compacto del otro miembro de la pareja; rechaza ajenos, alterados y repetidos. */
export async function openCompact(pair, bytes) {
  if (bytes[0] !== 1 || hex(bytes.subarray(1, 5)) !== hex(pair.pairId)) return { ok: false, reason: 'NOT_FOR_THIS_PAIR' };
  const seq = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5);
  if (pair.seen.has(seq)) return { ok: false, reason: 'REPLAY' };
  const iv = new Uint8Array(12); iv.set(pair.peerTag, 0); iv.set(bytes.subarray(5, 9), 4);
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: bytes.subarray(0, 9) }, pair.key, bytes.subarray(9));
    pair.seen.add(seq); return { ok: true, seq, text: td.decode(pt) };
  } catch { return { ok: false, reason: 'BAD_TAG' }; }
}
