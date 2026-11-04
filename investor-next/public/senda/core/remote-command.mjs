/**
 * SENDA · Órdenes remotas de un coordinador verificado a los teléfonos de una zona.
 *
 * Caso: alguien está atrapado en el edificio 14 y no puede tocar su móvil. El coordinador
 * (credencial institucional firmada, ver roles.mjs) envía una orden a los teléfonos SENDA
 * de ese edificio/planta: «emite baliza Bluetooth», «haz sonar la sirena», «barre Wi-Fi y
 * dime qué routers ves», «informa de batería y sensores». El teléfono SOLO la ejecuta si:
 *   1. la firma es de un coordinador verificado y la orden no ha caducado ni se ha repetido;
 *   2. su dueño preautorizó las órdenes remotas al instalar (consentimiento explícito);
 *   3. hay una zona de emergencia declarada que lo incluye.
 * Después planifica según la batería y lo que el sistema operativo permite (nunca enciende
 * radios a escondidas: si el SO exige un toque, lo deja pedido en pantalla y con sonido).
 */
import { b64, unb64 } from './b64.mjs';
import { verifyCredential } from './roles.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const ACTIONS = Object.freeze({
  BLE_BEACON: { label: 'Baliza Bluetooth (para localizarte)', energy: 1, needs: 'bluetooth', osTapIfOff: true },
  WIFI_SCAN: { label: 'Barrido Wi-Fi y envío de routers visibles', energy: 2, needs: 'wifi', osTapIfOff: true },
  SIREN: { label: 'Sirena y vibración a máximo volumen', energy: 2, needs: null, osTapIfOff: false },
  FLASH: { label: 'Destellos de linterna', energy: 3, needs: 'torch', osTapIfOff: false },
  ACOUSTIC_PING: { label: 'Emitir identificación por sonido (módem acústico)', energy: 2, needs: null, osTapIfOff: false },
  REPORT_STATUS: { label: 'Informar batería, sensores y última posición', energy: 0, needs: null, osTapIfOff: false },
  LOW_POWER_BEACON: { label: 'Baliza de bajo consumo cada 60 s (ahorrar batería)', energy: 0, needs: 'bluetooth', osTapIfOff: true },
});

const cmdBytes = (c) => enc.encode(JSON.stringify([c.id, c.issuedAt, c.expiresAt, c.target, c.actions, c.message ?? '', c.issuer.credential.sig]));

/** El coordinador firma una orden con la clave ligada a su credencial institucional. */
export async function signCommand({ issuerKeys, credential, target, actions, message, ttlS = 900, now }) {
  for (const a of actions) if (!ACTIONS[a]) throw new Error(`Acción desconocida: ${a}`);
  const id = b64(globalThis.crypto.getRandomValues(new Uint8Array(12)));
  const pub = await subtle.exportKey('jwk', issuerKeys.publicKey);
  const c = { v: 1, id, issuedAt: now, expiresAt: now + ttlS * 1000, target, actions, message, issuer: { credential, pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } } };
  c.sig = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, issuerKeys.privateKey, cmdBytes(c)));
  return c;
}

/**
 * Decide en el teléfono si ejecuta la orden y cómo.
 * @param {object} ctx {anchors, consent:{remoteCommands:boolean}, inDeclaredZone:boolean, battery:number, radios:{bluetooth,wifi,torch}, me:{buildingId,floor}, seen:Set, now}
 * @returns {Promise<{accepted:boolean, reason?:string, plan?:Array<{action,mode}>}>}
 */
export async function evaluateCommand(cmd, ctx) {
  const { now } = ctx;
  if (ctx.seen?.has(cmd.id)) return { accepted: false, reason: 'REPLAY' };
  if (now > cmd.expiresAt) return { accepted: false, reason: 'EXPIRED' };
  if (cmd.issuer.credential.subject !== await keyThumb(cmd.issuer.pub)) return { accepted: false, reason: 'KEY_NOT_BOUND_TO_CREDENTIAL' };
  const v = await verifyCredential(cmd.issuer.credential, ctx.anchors, now);
  if (!v.valid) return { accepted: false, reason: `CREDENTIAL_${v.reason}` };
  if (!/COORD|JEFE|MANDO|INCIDENT/i.test(v.role)) return { accepted: false, reason: 'NOT_A_COORDINATOR' };
  const key = await subtle.importKey('jwk', { ...cmd.issuer.pub, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(cmd.sig), cmdBytes(cmd)))) return { accepted: false, reason: 'BAD_SIGNATURE' };
  if (!ctx.consent?.remoteCommands) return { accepted: false, reason: 'NO_OWNER_CONSENT' };
  if (!ctx.inDeclaredZone) return { accepted: false, reason: 'NO_DECLARED_ZONE' };
  const t = cmd.target ?? {};
  if (t.buildingId && t.buildingId !== ctx.me?.buildingId) return { accepted: false, reason: 'NOT_TARGETED' };
  if (t.floors && !t.floors.includes(ctx.me?.floor)) return { accepted: false, reason: 'NOT_TARGETED' };
  ctx.seen?.add(cmd.id);
  return { accepted: true, issuer: { org: v.orgKind, role: v.role, unit: v.unit }, plan: planActions(cmd.actions, ctx) };
}

/** Planificación por batería: con poca carga, sustituye acciones caras por baliza de bajo consumo. */
export function planActions(actions, { battery = 100, radios = {} }) {
  const plan = [];
  for (const a of actions) {
    const spec = ACTIONS[a];
    if (battery <= 15 && spec.energy >= 2) { if (!plan.some((p) => p.action === 'LOW_POWER_BEACON')) plan.push({ action: 'LOW_POWER_BEACON', mode: radios.bluetooth ? 'RUN' : 'ASK_USER_TAP', reason: `Batería ${battery} %: se sustituye ${a}` }); continue; }
    if (spec.needs && !radios[spec.needs]) { plan.push({ action: a, mode: spec.osTapIfOff ? 'ASK_USER_TAP' : 'UNAVAILABLE', reason: `${spec.needs} apagado: el sistema operativo exige un toque` }); continue; }
    plan.push({ action: a, mode: 'RUN' });
  }
  return plan;
}

/** La credencial del coordinador debe nombrar como sujeto la huella de su clave de firma. */
export async function keyThumb(pub) {
  return b64(new Uint8Array(await subtle.digest('SHA-256', enc.encode(`${pub.x}.${pub.y}`))).subarray(0, 16));
}
