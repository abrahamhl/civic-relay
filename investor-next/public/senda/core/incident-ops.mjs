/**
 * SENDA · Operación de incidente de extremo a extremo (lo que un organismo usa en una emergencia).
 *
 * Une piezas que ya estaban probadas por separado y que nadie encadenaba:
 *   roles.mjs (ancla de confianza y credencial) → remote-command.mjs (orden firmada, verificación en
 *   cada teléfono, respuestas y cuadro) → interop.mjs (CAP 1.2 para la sala 112 y auditoría encadenada).
 *
 * Flujo: setupAgency → issueZoneOrder → deliverOrder (cada teléfono la recibe según los canales vivos
 * y la verifica: firma, credencial, rol, consentimiento, zona, repetición, caducidad) → collectResponses
 * (las respuestas vuelven por los mismos canales) → situationReport (cuadro + CAP + auditoría).
 *
 * La población de teléfonos es SINTÉTICA y reproducible con semilla (simulatePopulation); los
 * porcentajes de consentimiento y de respuesta son HIPÓTESIS declaradas en STATUS_MODEL, no datos.
 * Todo lo criptográfico es real (WebCrypto P-256): nada se simula en la cadena de confianza.
 */
import { createOrganization, issueCredential } from './roles.mjs';
import { signCommand, evaluateCommand, keyThumb, buildResidentResponse, aggregateResponses } from './remote-command.mjs';
import { toCap, createAuditLog, verifyAuditLog } from './interop.mjs';

const subtle = globalThis.crypto.subtle;

/** Generador reproducible (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Hipótesis declaradas (pendientes de calibrar con ensayos reales). */
export const STATUS_MODEL = Object.freeze({ SAFE: 0.7, NEED_HELP: 0.12, TRAPPED: 0.03, AWAY: 0.05, NO_RESPONSE: 0.1 });

/**
 * Organismo + coordinador. La credencial nombra como sujeto la huella de la clave de firma del
 * coordinador: sin esa clave nadie puede firmar órdenes con esa credencial.
 */
export async function setupAgency({ orgId = 'PC-MAD', orgName = 'Protección Civil (ejercicio)', kind = 'CIVIL_PROTECTION', role = 'COORDINADOR_INCIDENTE', unit = 'Puesto de mando avanzado', now, validH = 12 }) {
  if (!Number.isFinite(now)) throw new TypeError('now obligatorio');
  const org = await createOrganization({ id: orgId, name: orgName, kind });
  const coordKeys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const subject = await keyThumb(await subtle.exportKey('jwk', coordKeys.publicKey));
  const credential = await issueCredential(org, { subject, role, unit, validFrom: now - 60_000, validUntil: now + validH * 3600_000 });
  const audit = createAuditLog();
  await audit.append({ at: now, actor: orgId, action: 'ANCHOR_AND_CREDENTIAL', data: { orgKind: kind, role, unit, subject } });
  return { org, anchors: [org.anchor], coordKeys, credential, audit, orders: [], seen: new Map() };
}

/**
 * Teléfonos sintéticos por pueblo: consentimiento, batería y radios variables.
 * @param {Array<{id:string,name?:string,population?:number}>} towns
 */
export function simulatePopulation(towns, { perTown = 40, seed = 1, consentRate = 0.85 } = {}) {
  const R = rng(seed), phones = [];
  for (const t of towns) for (let i = 0; i < perTown; i++) {
    const battery = Math.round(5 + R() * 95);
    phones.push({ id: `${t.id}-${String(i).padStart(3, '0')}`, townId: t.id, buildingId: `${t.id}-B${1 + Math.floor(R() * 8)}`, floor: Math.floor(R() * 4), unit: 'ABCD'[Math.floor(R() * 4)],
      consent: R() < consentRate, battery, radios: { bluetooth: R() < 0.7, wifi: R() < 0.8, torch: true } });
  }
  return phones;
}

/** El coordinador firma una orden dirigida a una zona (lista de pueblos). Queda en la auditoría. */
export async function issueZoneOrder(ops, { zone, actions = ['SIREN', 'REPORT_STATUS', 'BLE_BEACON'], message, now, ttlS = 1800 }) {
  if (!Array.isArray(zone) || !zone.length) throw new Error('zona vacía');
  const cmd = await signCommand({ issuerKeys: ops.coordKeys, credential: ops.credential, target: { zone: [...zone] }, actions, message, ttlS, now, kind: 'ALERT' });
  ops.orders.push(cmd);
  await ops.audit.append({ at: now, actor: ops.credential.subject, action: 'ORDER_SIGNED', data: { id: cmd.id, zone, actions, expiresAt: cmd.expiresAt } });
  return cmd;
}

/**
 * Entrega la orden a cada teléfono y la evalúa EN el teléfono (evaluateCommand).
 * `pDeliver(phone)` = probabilidad de que le llegue por los canales vivos de su zona (el Centro la calcula
 * con la física de cada canal y las antenas en pie). Devuelve el resultado por teléfono y el recuento.
 */
export async function deliverOrder(ops, cmd, phones, { now, pDeliver = () => 0.95, seed = 7 } = {}) {
  const R = rng(seed), zone = new Set(cmd.target?.zone ?? []), out = [], reasons = {};
  for (const ph of phones) {
    const delivered = R() < pDeliver(ph);
    if (!delivered) { out.push({ phone: ph.id, townId: ph.townId, delivered: false }); reasons.NOT_DELIVERED = (reasons.NOT_DELIVERED ?? 0) + 1; continue; }
    const seen = ops.seen.get(ph.id) ?? new Set(); ops.seen.set(ph.id, seen);
    const v = await evaluateCommand(cmd, { anchors: ops.anchors, consent: { remoteCommands: ph.consent }, inDeclaredZone: zone.has(ph.townId), battery: ph.battery, radios: ph.radios, me: { buildingId: ph.buildingId, floor: ph.floor }, seen, now });
    const key = v.accepted ? 'ACCEPTED' : v.reason; reasons[key] = (reasons[key] ?? 0) + 1;
    out.push({ phone: ph.id, townId: ph.townId, delivered: true, accepted: v.accepted, reason: v.reason ?? null, plan: v.plan ?? [] });
  }
  await ops.audit.append({ at: now, actor: 'SENDA', action: 'ORDER_DELIVERY', data: { id: cmd.id, phones: phones.length, ...reasons } });
  return { results: out, reasons };
}

/**
 * Respuestas de los teléfonos que aceptaron: estado según STATUS_MODEL (o el que pulse el usuario en una
 * prueba real) y vuelta por los mismos canales. Agrega el cuadro por edificio y planta.
 */
export async function collectResponses(ops, cmd, phones, delivery, { now, pReturn = () => 0.95, seed = 11, statusOf = null } = {}) {
  const R = rng(seed), byId = new Map(phones.map((p) => [p.id, p])), responses = [];
  const draw = () => { let u = R(), acc = 0; for (const [s, p] of Object.entries(STATUS_MODEL)) { acc += p; if (u < acc) return s; } return 'NO_RESPONSE'; };
  let lostOnReturn = 0;
  for (const r of delivery.results) {
    if (!r.accepted) continue;
    const ph = byId.get(r.phone), status = statusOf ? statusOf(ph) : draw();
    if (!(R() < pReturn(ph))) { lostOnReturn++; continue; }
    responses.push({ ...buildResidentResponse({ cmdId: cmd.id, status, profile: ph, battery: ph.battery, plan: r.plan, at: now + Math.floor(R() * 600_000) }), from: ph.id, townId: ph.townId });
  }
  const board = aggregateResponses(responses, { alerts: [cmd], now: now + 600_000 });
  await ops.audit.append({ at: now + 600_000, actor: 'SENDA', action: 'RESPONSES_AGGREGATED', data: { id: cmd.id, responses: responses.length, lostOnReturn, totals: board.totals } });
  return { responses, board, lostOnReturn };
}

/** Parte de situación en CAP 1.2 (ámbito restringido, para la sala 112) + cierre de auditoría. */
export async function situationReport(ops, cmd, board, { now, areaDesc, circle = null, sender = 'senda@organismo.example', exercise = true }) {
  const t = board.totals, n = (k) => t[k] ?? 0;
  const cap = toCap({ identifier: `SENDA-OPS-${cmd.id.replace(/[^A-Za-z0-9]/g, '')}`, sender, sent: now, status: exercise ? 'Exercise' : 'Actual', msgType: 'Alert', scope: 'Restricted',
    info: { category: 'Fire', event: 'Situación de la población en la zona', urgency: 'Immediate', severity: n('TRAPPED_CONFIRMED') ? 'Extreme' : 'Severe', certainty: 'Observed',
      headline: `Zona ${cmd.target.zone.join(', ')}: ${n('CONFIRMED_SAFE')} a salvo, ${n('CONFIRMED_NEEDS_HELP')} piden ayuda, ${n('TRAPPED_CONFIRMED')} atrapados, ${n('SIGNAL_NO_RESPONSE')} sin respuesta`,
      description: 'Respuestas cifradas de teléfonos SENDA a una orden firmada por un coordinador acreditado. «Sin respuesta» indica un teléfono activo cuyo dueño no contesta: nunca implica víctima.',
      parameters: [['SENDA_ORDER', cmd.id], ['SAFE', n('CONFIRMED_SAFE')], ['NEED_HELP', n('CONFIRMED_NEEDS_HELP')], ['TRAPPED', n('TRAPPED_CONFIRMED')], ['AWAY', n('NOT_IN_BUILDING')], ['NO_RESPONSE', n('SIGNAL_NO_RESPONSE')]],
      area: circle ? { areaDesc: areaDesc ?? cmd.target.zone.join(', '), circle } : { areaDesc: areaDesc ?? cmd.target.zone.join(', ') } } });
  const capHash = [...new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(cap)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await ops.audit.append({ at: now, actor: ops.credential.subject, action: 'CAP_SITUATION_REPORT', data: { id: cmd.id, capSha256: capHash } });
  const entries = ops.audit.entries();
  return { cap, capSha256: capHash, audit: entries, auditCheck: await verifyAuditLog(entries) };
}
