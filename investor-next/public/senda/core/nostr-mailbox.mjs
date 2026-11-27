/**
 * SENDA · Buzón descentralizado sobre relés Nostr públicos (sin servidor propio, sin cuenta, sin coste).
 *
 * Por qué Nostr: miles de relés independientes, gestionados por personas y organizaciones distintas en muchos
 * países, que guardan y reparten «eventos» firmados a quien se suscriba, por WebSocket y en tiempo real. Ninguno
 * es imprescindible: publicamos en varios a la vez y basta con que funcione uno. No es un servicio de SENDA ni
 * depende de nosotros.
 *
 * Qué ve un relé (o cualquiera que lea los relés), y qué no:
 *  - Ve: un evento kind 1059 (formato «gift wrap», NIP-59) firmado por una clave de UN SOLO USO, con una etiqueta
 *    `p` que parece la clave pública de un desconocido, una caducidad (NIP-40) y un bloque cifrado.
 *  - No ve: ni quién envía, ni quién recibe, ni el contenido, ni el tamaño exacto del texto. La etiqueta `p` es el
 *    BUZÓN CEGADO de la pareja para ese día: una clave secp256k1 derivada de la clave compartida ECDH P-256 de los
 *    dos (que solo ellos conocen) y del número de día. Cambia cada día, así que no se pueden enlazar días.
 *    Dentro de un mismo día, un observador sí puede ver que varios eventos van al mismo buzón (no de quién son).
 *  - El contenido es el sobre SENDA (ya cifrado de extremo a extremo y firmado por el remitente) cifrado OTRA VEZ
 *    con AES-256-GCM y la clave de la pareja del día: así ni la huella del destinatario, que va en la cabecera del
 *    sobre, queda a la vista. Con relleno a bloques de 256 B, el tamaño no delata la longitud del texto.
 *
 * Sin contrapartidas para quien transporta: el REMITENTE prepara este evento al escribir, aunque no tenga red
 * (`prewrap`). El evento viaja pegado al sobre (bundle.mjs, campo `wrap`) y cualquier móvil o relé que gane Internet lo
 * publica TAL CUAL: no necesita saber a quién va, ni usar un buzón que delate al destinatario, ni aceptar nada a cambio.
 *
 * El relé no puede falsificar mensajes: el sobre interior lleva firma ECDSA P-256 del remitente y se verifica al
 * abrirlo. Repetir un evento no sirve de nada: el almacén descarta duplicados por id.
 */
import { schnorr, utils as secpUtils } from './noble-secp256k1.mjs';
import { b64, unb64 } from './b64.mjs';
import { packEnvelope, unpackEnvelope } from './envelope.mjs';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
export const MAILBOX_KIND = 1059;
export const DAY_MS = 86_400_000;
export const PAD_BLOCK = 256;
const PREFIX_MSG = 0x01, PREFIX_RECEIPT = 0x02;

export const hex = (u8) => [...u8].map((x) => x.toString(16).padStart(2, '0')).join('');
export const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const sha256 = async (bytes) => new Uint8Array(await subtle.digest('SHA-256', bytes));
const dayOf = (ms) => Math.floor(ms / DAY_MS);

async function hkdf(ikm, info, len = 32) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(info) }, k, len * 8));
}

/** Clave secp256k1 válida a partir de bytes (rehash hasta que caiga en 1..n-1; probabilidad de repetir ≈ 2^-128). */
async function toSecretKey(seed) {
  let s = seed;
  for (let i = 0; i < 8; i++) { if (secpUtils.isValidSecretKey(s)) return s; s = await sha256(s); }
  throw new Error('NO_VALID_KEY');
}

/**
 * Secreto de la pareja: ECDH P-256 entre MI clave de buzón (identity.box) y la del contacto. Simétrico: los dos
 * obtienen lo mismo. Ordenamos las huellas para que el contexto también sea simétrico.
 */
export async function pairSecret(identity, peerPublic) {
  const peer = await subtle.importKey('jwk', { ...peerPublic.boxPub, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peer }, identity.box.privateKey, 256));
  const ids = [identity.publicIdentity.fingerprint, peerPublic.fingerprint].sort().join('|');
  return hkdf(new Uint8Array([...bits, ...te.encode(ids)]), 'senda-nostr-pair/v1');
}

/** Buzón cegado de la pareja para un día: clave secp256k1 (los dos pueden firmar AUTH NIP-42 si un relé lo pide) + clave AES. */
export async function pairMailbox(secret, day) {
  const sk = await toSecretKey(await hkdf(secret, `senda-nostr-mailbox/v1/${day}`));
  const aes = await hkdf(secret, `senda-nostr-wrap/v1/${day}`);
  return { day, sk, pub: hex(schnorr.getPublicKey(sk)), aes, kind: 'PAIR' };
}

/** Días a vigilar: desde `back` días atrás hasta mañana (relojes desfasados entre países). */
export function daysAround(nowMs, back = 7) { const d = dayOf(nowMs); const out = []; for (let i = d - back; i <= d + 1; i++) out.push(i); return out; }

async function aesWrap(keyBytes, plain) {
  const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const padded = new Uint8Array(Math.ceil((plain.length + 4) / PAD_BLOCK) * PAD_BLOCK);
  new DataView(padded.buffer).setUint32(0, plain.length); padded.set(plain, 4);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, padded));
  return new Uint8Array([...iv, ...ct]);
}
async function aesUnwrap(keyBytes, data) {
  const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12) }, key, data.subarray(12)));
  const n = new DataView(pt.buffer).getUint32(0);
  if (n > pt.length - 4) throw new Error('BAD_PADDING');
  return pt.subarray(4, 4 + n);
}

/** Serialización canónica NIP-01 → id = sha256 hex. */
export async function eventId(ev) {
  return hex(await sha256(te.encode(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]))));
}
export async function verifyEvent(ev) {
  if (!ev || typeof ev.id !== 'string' || typeof ev.sig !== 'string' || typeof ev.pubkey !== 'string') return false;
  if ((await eventId(ev)) !== ev.id) return false;
  try { return await schnorr.verifyAsync(unhex(ev.sig), unhex(ev.id), unhex(ev.pubkey)); } catch { return false; }
}

/** Firma con una clave de un solo uso (el autor no se puede enlazar con nadie). */
async function signEphemeral(unsigned) {
  const sk = secpUtils.randomSecretKey();
  const ev = { ...unsigned, pubkey: hex(schnorr.getPublicKey(sk)) };
  ev.id = await eventId(ev);
  ev.sig = hex(await schnorr.signAsync(unhex(ev.id), sk));
  return ev;
}

/**
 * Evento listo para publicar con un sobre SENDA dentro.
 * @param {{mailbox: Awaited<ReturnType<typeof pairMailbox>>, envelope: object, nowMs: number}} p
 */
export async function wrapEnvelope({ mailbox, envelope, nowMs }) {
  const inner = new Uint8Array([PREFIX_MSG, ...packEnvelope(envelope)]);
  const expiration = Math.floor(envelope.header.expiresAt / 1000);
  return signEphemeral({ kind: MAILBOX_KIND, created_at: Math.floor(nowMs / 1000), tags: [['p', mailbox.pub], ['expiration', String(expiration)]], content: b64(await aesWrap(mailbox.aes, inner)) });
}

/** Recibo de entrega por el mismo buzón: borra copias en tránsito y marca «entregado» en el remitente. */
export async function wrapReceipt({ mailbox, receipt, nowMs, ttlS = 7 * 86400 }) {
  const inner = new Uint8Array([PREFIX_RECEIPT, ...te.encode(JSON.stringify({ id: receipt.id, ackSecret: receipt.ackSecret }))]);
  return signEphemeral({ kind: MAILBOX_KIND, created_at: Math.floor(nowMs / 1000), tags: [['p', mailbox.pub], ['expiration', String(Math.floor(nowMs / 1000) + ttlS)]], content: b64(await aesWrap(mailbox.aes, inner)) });
}

/**
 * Abre un evento recibido con los buzones que vigilo. Devuelve {type:'ENVELOPE', envelope} | {type:'RECEIPT', receipt} | null.
 * Rechaza firmas Nostr inválidas, buzones ajenos y contenido alterado.
 */
export async function unwrapEvent(ev, mailboxesByPub) {
  if (ev?.kind !== MAILBOX_KIND || !(await verifyEvent(ev))) return null;
  const p = ev.tags?.find((t) => t[0] === 'p')?.[1];
  const mb = mailboxesByPub.get(p); if (!mb) return null;
  let inner; try { inner = await aesUnwrap(mb.aes, unb64(ev.content)); } catch { return null; }
  if (inner[0] === PREFIX_MSG) { try { return { type: 'ENVELOPE', envelope: unpackEnvelope(inner.subarray(1)), mailbox: mb }; } catch { return null; } }
  if (inner[0] === PREFIX_RECEIPT) { try { const r = JSON.parse(new TextDecoder().decode(inner.subarray(1))); return typeof r.id === 'string' && typeof r.ackSecret === 'string' ? { type: 'RECEIPT', receipt: r, mailbox: mb } : null; } catch { return null; } }
  return null;
}

/** Filtro NIP-01 para suscribirse a mis buzones. */
export function mailboxFilter(pubs, sinceMs) { return { kinds: [MAILBOX_KIND], '#p': [...pubs], since: Math.floor(sinceMs / 1000) }; }

/** Todos los buzones que debe vigilar un teléfono: pareja con cada contacto (días −7…+1). Map pub → buzón. */
export async function myMailboxes({ identity, contacts, nowMs, back = 7 }) {
  const map = new Map(), days = daysAround(nowMs, back);
  for (const c of contacts) {
    const s = await pairSecret(identity, c);
    for (const d of days) { const mb = await pairMailbox(s, d); mb.peer = c.fingerprint; map.set(mb.pub, mb); }
  }
  return map;
}

/**
 * Evento exterior preparado por el remitente al escribir (sin red). Viaja con el sobre y lo publica quien llegue antes
 * a Internet. El día del buzón es el de escritura; el destinatario vigila 7 días atrás.
 */
export async function prewrap({ identity, contact, envelope, nowMs }) {
  return wrapEnvelope({ mailbox: await pairMailbox(await pairSecret(identity, contact), Math.floor(nowMs / DAY_MS)), envelope, nowMs });
}
