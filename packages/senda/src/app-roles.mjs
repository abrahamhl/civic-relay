/**
 * Roles de la app SENDA sin servidor y sin red (fase privada: fundador y hermano).
 *
 *  · ADMIN             quien posee la clave privada de administrador (ECDSA P-256). Todo.
 *  · OBSERVADOR_TOTAL  quien presenta una credencial firmada por esa clave, vigente y no revocada.
 *                      Ve y usa todo; NO edita la configuración global ni emite credenciales.
 *                      La bóveda de defensa solo si la credencial lleva la concesión VAULT firmada.
 *  · CIUDADANO         todo lo demás (sin firma, caducada, revocada, manipulada, ancla desconocida).
 *
 * Se verifica sin red. Límites declarados (no se disimulan):
 *  - La caducidad depende del reloj del móvil; se detecta el retroceso respecto a lo ya visto, no un
 *    reloj falso desde el primer uso.
 *  - Una revocación solo surte efecto cuando la lista firmada llega al móvil (QR o archivo).
 *  - El ancla (clave pública del ADMIN) se fija en el primer emparejamiento y no se cambia sin borrar.
 */
import { b64, unb64 } from './b64.mjs';
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };

export const ROLES = Object.freeze({ ADMIN: 'ADMIN', OBSERVADOR_TOTAL: 'OBSERVADOR_TOTAL', CIUDADANO: 'CIUDADANO' });
export const GRANTS = Object.freeze({ VAULT: 'VAULT' });
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
export const QR_PREFIX = Object.freeze({ ANCHOR: 'SENDA-ANCLA-APP:', CREDENTIAL: 'SENDA-ROL:', REVOCATION: 'SENDA-REVOCA:' });

/** Acciones y quién puede hacerlas. */
const PUBLIC_ACTIONS = ['view.public'];
const OBSERVER_ACTIONS = [...PUBLIC_ACTIONS, 'view.all', 'use.simulator', 'use.radar', 'use.cameras.full', 'use.fieldtrials', 'view.logs.own'];
const ADMIN_ONLY = ['config.edit', 'credential.issue', 'credential.revoke', 'audit.view', 'export.all'];

const url = b64; // b64 ya es base64url sin relleno
const unurl = unb64;

export async function createAdmin() {
  const keys = await subtle.generateKey(ALG, false, ['sign', 'verify']); // la privada no se puede exportar ni copiar
  return { keys, anchor: { publicJwk: strip(await subtle.exportKey('jwk', keys.publicKey)) } };
}
const strip = (j) => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });
const verifyKey = (jwk) => subtle.importKey('jwk', strip(jwk), ALG, false, ['verify']);
export const sameAnchor = (a, b) => !!a && !!b && a.publicJwk.x === b.publicJwk.x && a.publicJwk.y === b.publicJwk.y;

const credBytes = (c) => enc.encode(JSON.stringify(['SENDA-APP-ROLE-v1', c.id, c.subject, c.role, c.grants, c.validFrom, c.validUntil]));
const revBytes = (r) => enc.encode(JSON.stringify(['SENDA-APP-REVOKE-v1', r.issuedAt, r.revokedIds]));

/** Solo el ADMIN (con su clave privada) puede emitir. ADMIN no se emite: se posee. */
export async function issueCredential(admin, { subject, grants = [], validFrom, validUntil, id }) {
  if (!admin?.keys?.privateKey) throw new Error('solo el administrador emite credenciales');
  if (!(validUntil > validFrom)) throw new Error('validUntil debe ser posterior a validFrom');
  for (const g of grants) if (!Object.values(GRANTS).includes(g)) throw new Error(`concesión desconocida: ${g}`);
  const cred = { v: 1, id: id ?? url(globalThis.crypto.getRandomValues(new Uint8Array(8))), subject, role: ROLES.OBSERVADOR_TOTAL, grants: [...grants].sort(), validFrom, validUntil };
  cred.sig = b64(await subtle.sign(SIG, admin.keys.privateKey, credBytes(cred)));
  return cred;
}

export async function issueRevocation(admin, { revokedIds, issuedAt }) {
  if (!admin?.keys?.privateKey) throw new Error('solo el administrador revoca');
  const r = { v: 1, issuedAt, revokedIds: [...new Set(revokedIds)].sort() };
  r.sig = b64(await subtle.sign(SIG, admin.keys.privateKey, revBytes(r)));
  return r;
}

/** Acepta una lista de revocación nueva solo si está bien firmada y no es más antigua que la guardada. */
export async function acceptRevocation(current, incoming, anchor) {
  try {
    if (!incoming || incoming.v !== 1 || !Array.isArray(incoming.revokedIds)) return { ok: false, reason: 'MALFORMED' };
    const key = await verifyKey(anchor.publicJwk);
    if (!(await subtle.verify(SIG, key, unb64(incoming.sig), revBytes(incoming)))) return { ok: false, reason: 'BAD_SIGNATURE' };
    if (current && incoming.issuedAt < current.issuedAt) return { ok: false, reason: 'OLDER_THAN_STORED' };
    return { ok: true, revocation: incoming };
  } catch { return { ok: false, reason: 'MALFORMED' }; }
}

/**
 * Resuelve el rol de este móvil. Nunca lanza: ante cualquier duda, CIUDADANO con el motivo.
 * `state.lastSeenMs` es el instante más alto observado en este móvil (para detectar retroceso del reloj).
 */
export async function resolveRole({ adminKeys = null, credential = null, anchor = null, revocation = null, now, lastSeenMs = 0 }) {
  const citizen = (reason) => ({ role: ROLES.CIUDADANO, grants: [], reason });
  if (now < lastSeenMs - CLOCK_TOLERANCE_MS) return citizen('CLOCK_ROLLBACK');
  try {
    if (adminKeys?.privateKey && anchor && sameAnchor(anchor, await exportAnchor(adminKeys))) return { role: ROLES.ADMIN, grants: [], reason: 'OWNS_ADMIN_KEY' };
    if (!credential) return citizen('NONE');
    if (!anchor) return citizen('NO_ANCHOR');
    if (credential.v !== 1 || credential.role !== ROLES.OBSERVADOR_TOTAL) return citizen('ROLE_NOT_ISSUABLE');
    if (revocation?.revokedIds?.includes(credential.id)) return citizen('REVOKED');
    if (now < credential.validFrom) return citizen('NOT_YET_VALID');
    if (now > credential.validUntil) return citizen('EXPIRED');
    const key = await verifyKey(anchor.publicJwk);
    if (!(await subtle.verify(SIG, key, unb64(credential.sig), credBytes(credential)))) return citizen('BAD_SIGNATURE');
    return { role: ROLES.OBSERVADOR_TOTAL, grants: credential.grants, reason: 'VALID', credentialId: credential.id, expiresAt: credential.validUntil };
  } catch { return citizen('MALFORMED'); }
}
async function exportAnchor(keys) { return { publicJwk: strip(await subtle.exportKey('jwk', keys.publicKey)) }; }

export function can(resolved, action) {
  if (resolved.role === ROLES.ADMIN) return true;
  if (ADMIN_ONLY.includes(action)) return false;
  if (action === 'vault.view') return resolved.role === ROLES.OBSERVADOR_TOTAL && resolved.grants.includes(GRANTS.VAULT);
  if (resolved.role === ROLES.OBSERVADOR_TOTAL) return OBSERVER_ACTIONS.includes(action);
  return PUBLIC_ACTIONS.includes(action);
}

/** Texto para QR. Compacto: una credencial cabe en un QR de tamaño normal. */
export const encodeQr = (prefix, obj) => prefix + url(enc.encode(JSON.stringify(obj)));
export function decodeQr(prefix, text) {
  if (typeof text !== 'string' || !text.startsWith(prefix)) throw new Error('código no reconocido');
  return JSON.parse(new TextDecoder().decode(unurl(text.slice(prefix.length))));
}
