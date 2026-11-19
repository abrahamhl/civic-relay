/**
 * SENDA RoadSafe · Emergency Interoperability Gateway — expedientes transferibles, nunca llamadas automáticas.
 *
 * Contexto normativo/técnico (estado de verificación en docs/roadsafe/01_INTEROP_MATRIX.md):
 *  - eCall (Reglamento (UE) 2015/758; MSD EN 15722): lo hace el VEHÍCULO directamente con el 112.
 *  - AML (Advanced Mobile Location, ETSI TS 103 625): la localización la envía el SISTEMA OPERATIVO del
 *    móvil al marcar 112. SENDA no la sustituye ni interfiere.
 *  - NG112 (EENA, arquitectura IP/SIP con localización PIDF-LO) y PEMEA (ETSI TS 103 478, apps de
 *    emergencia federadas): exigen acuerdo con el PSAP/proveedor de servicio; NO hay acceso público.
 *  - CAP 1.2 (OASIS): formato de alerta; `status=Exercise` NUNCA se presenta como alerta oficial.
 *
 * Reglas duras de este módulo:
 *  1. La llamada convencional al 112 está SIEMPRE disponible y es una acción humana (tel:112).
 *  2. Ningún test ni simulación contacta servicios reales: solo endpoints registrados con
 *     `agreementRef` y `institutionalAuth`; en modo prueba solo simuladores.
 *  3. Separación: CITIZEN_REPORT (denuncia ciudadana) ≠ TECHNICAL_OBSERVATION ≠ AUTHORIZED_DISPATCH.
 *     Solo un PSAP con credencial puede producir AUTHORIZED_DISPATCH.
 *  4. Una sola escalada activa por incidente (dedupe por ventana); revocación y TTL explícitos.
 */

export const DOSSIER_STATES = Object.freeze(['PREPARED', 'SHOWN_TO_CITIZEN', 'SUBMITTED_TO_ENDPOINT', 'TECHNICAL_RECEIPT', 'PSAP_ACCEPTED', 'REVOKED', 'EXPIRED']);
export const INFO_CLASSES = Object.freeze(['CITIZEN_REPORT', 'TECHNICAL_OBSERVATION', 'AUTHORIZED_DISPATCH']);

/** Acción de llamada: siempre disponible, nunca automática. */
export function call112Action() {
  return { href: 'tel:112', label: { es: 'Llamar al 112', en: 'Call 112', nl: 'Bel 112' }, automatic: false, alwaysAvailable: true, note: 'El sistema operativo puede enviar la ubicación AML al 112 al marcar; SENDA no interviene en esa llamada.' };
}

/**
 * Expediente estructurado: lo que un operador del 112 necesita, en orden, sin datos no consentidos.
 * Formato neutro y mapeable (ubicación tipo PIDF-LO: punto + incertidumbre; info tipo CAP).
 */
export function buildEmergencyDossier(incidentPublic, { now, ttlS = 3600, exercise = true, scene = {}, consentedPersonal = {} } = {}) {
  if (!Number.isFinite(now)) throw new Error('dossier: reloj requerido');
  const loc = incidentPublic.location;
  return {
    schema: 'senda-roadsafe-emergency-dossier/1', dossierId: `ED-${incidentPublic.id}-${now}`, incidentId: incidentPublic.id,
    infoClass: 'CITIZEN_REPORT', status: exercise ? 'Exercise' : 'Draft', createdAt: now, expiresAt: now + ttlS, state: 'PREPARED',
    location: { point: { lat: loc.lat, lon: loc.lon }, uncertaintyM: loc.accuracyM ?? null, road: loc.roadId, pk: loc.pk, direction: loc.dir, laneHint: loc.lane },
    situation: { kind: incidentPublic.kind, state: incidentPublic.state, secondaryCollision: ['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(incidentPublic.state), confidence: incidentPublic.confidence, ...pick(scene, ['vehicles', 'people', 'trapped', 'fire', 'dangerousGoods', 'v16Active']) },
    personal: consentedPersonal, // solo lo que el afectado consintió compartir
    script: dossierScript(incidentPublic, scene),
    disclaimer: exercise ? 'EJERCICIO — no es una alerta oficial ni una solicitud de despacho.' : 'Información aportada por un ciudadano; requiere verificación del 112.',
  };
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
function dossierScript(inc, scene) {
  const l = inc.location, parts = [];
  parts.push(`${inc.kind === 'BREAKDOWN' ? 'Vehículo averiado' : 'Incidente de tráfico'} en ${l.roadId ?? 'carretera sin identificar'}${l.pk != null ? `, punto kilométrico ${l.pk}` : ''}${l.dir != null ? `, sentido ${l.dir > 0 ? 'creciente' : 'decreciente'}` : ''}.`);
  if (['SECONDARY_COLLISION_SUSPECTED', 'EMERGENCY_ESCALATION_REQUIRED'].includes(inc.state)) parts.push('Posible colisión por alcance tras la avería.');
  if (scene.vehicles) parts.push(`${scene.vehicles} vehículo(s) implicados.`);
  if (scene.people != null) parts.push(`${scene.people} persona(s).`);
  if (scene.trapped) parts.push(`${scene.trapped} persona(s) atrapada(s).`);
  if (scene.v16Active === true) parts.push('Baliza V16 encendida.');
  parts.push(`Coordenadas ${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}.`);
  return parts.join(' ');
}

/**
 * Pasarela. endpoints: [{ id, kind:'PSAP'|'TRAFFIC_CENTRE'|'SIMULATOR', agreementRef, institutionalAuth, send(dossier) }]
 * mode: 'TEST' (solo SIMULATOR) | 'PILOT' (endpoints con acuerdo). No existe modo que llame por voz.
 */
export function createEmergencyGateway({ endpoints = [], mode = 'TEST', escalationWindowS = 900 } = {}) {
  const dossiers = new Map(), escalations = new Map(), log = [];
  const L = (e) => log.push(e);
  function register(d) { dossiers.set(d.dossierId, d); L({ at: d.createdAt, op: 'PREPARED', dossierId: d.dossierId }); return d; }

  /** Escalada deduplicada: una activa por incidente dentro de la ventana; las demás se enlazan. */
  function escalate(incidentId, { now, reason, dossier }) {
    const prev = escalations.get(incidentId);
    if (prev && now - prev.at <= escalationWindowS && !prev.revoked) { prev.linked.push({ at: now, reason }); L({ at: now, op: 'ESCALATION_DEDUPED', incidentId }); return { ok: true, deduped: true, escalation: prev }; }
    const e = { incidentId, at: now, reason, dossierId: dossier?.dossierId ?? null, linked: [], revoked: false, action: call112Action() };
    escalations.set(incidentId, e); L({ at: now, op: 'ESCALATION', incidentId, reason });
    return { ok: true, deduped: false, escalation: e };
  }

  /** El ciudadano ve el guion y el botón de llamada: registro de que se MOSTRÓ, no de que se llamó. */
  function showToCitizen(dossierId, { now }) { const d = dossiers.get(dossierId); if (!d || isDead(d, now)) return { ok: false }; d.state = 'SHOWN_TO_CITIZEN'; L({ at: now, op: 'SHOWN_TO_CITIZEN', dossierId }); return { ok: true, action: call112Action(), script: d.script }; }

  const isDead = (d, now) => { if (d.state === 'REVOKED') return true; if (now > d.expiresAt) { d.state = 'EXPIRED'; return true; } return false; };

  /** Envío a un endpoint registrado (solo con acuerdo). En modo TEST solo simuladores. */
  async function submit(dossierId, endpointId, { now }) {
    const d = dossiers.get(dossierId), ep = endpoints.find((e) => e.id === endpointId);
    if (!d) return { ok: false, error: 'expediente desconocido' };
    if (isDead(d, now)) return { ok: false, error: `expediente ${d.state}` };
    if (!ep) return { ok: false, error: 'endpoint no registrado' };
    if (mode === 'TEST' && ep.kind !== 'SIMULATOR') return { ok: false, error: 'modo TEST: prohibido contactar servicios reales' };
    if (ep.kind !== 'SIMULATOR' && !(ep.agreementRef && ep.institutionalAuth)) return { ok: false, error: 'endpoint sin acuerdo institucional ni autenticación' };
    d.state = 'SUBMITTED_TO_ENDPOINT'; L({ at: now, op: 'SUBMIT', dossierId, endpointId });
    let r; try { r = await ep.send(structuredClone(d)); } catch (e) { r = { transport: 'ERROR' }; }
    if (r?.transport === 'HTTP' && r.status >= 200 && r.status < 300) { d.state = 'TECHNICAL_RECEIPT'; L({ at: now, op: 'TECHNICAL_RECEIPT', dossierId }); }
    else L({ at: now, op: 'SUBMIT_FAILED', dossierId, transport: r?.transport ?? 'UNKNOWN', status: r?.status ?? null });
    return { ok: d.state === 'TECHNICAL_RECEIPT', state: d.state };
  }

  /** Aceptación del PSAP: solo con referencia y credencial institucional verificada (no inferida del 2xx). */
  function psapAccept(dossierId, { now, psapReference, actor }) {
    const d = dossiers.get(dossierId);
    if (!d || isDead(d, now)) return { ok: false, error: 'expediente no vigente' };
    if (!(actor?.kind === 'EMERGENCY_SERVICE' && actor.verified === true)) return { ok: false, error: 'solo un PSAP verificado acepta' };
    if (!psapReference) return { ok: false, error: 'referencia del PSAP obligatoria' };
    d.state = 'PSAP_ACCEPTED'; d.psapReference = psapReference; d.infoClass = 'AUTHORIZED_DISPATCH';
    L({ at: now, op: 'PSAP_ACCEPTED', dossierId, psapReference, by: actor.id ?? null });
    return { ok: true };
  }
  function revoke(dossierId, { now, reason }) { const d = dossiers.get(dossierId); if (!d) return { ok: false }; d.state = 'REVOKED'; L({ at: now, op: 'REVOKED', dossierId, reason }); const e = escalations.get(d.incidentId); if (e && e.dossierId === dossierId) e.revoked = true; return { ok: true }; }

  /** CAP: nunca 'Actual' sin credencial institucional; un ejercicio siempre lleva status=Exercise. */
  function capStatusFor({ actor, exercise = true }) {
    if (exercise) return 'Exercise';
    return actor?.kind === 'EMERGENCY_SERVICE' && actor.verified === true ? 'Actual' : null;
  }
  return { register, escalate, showToCitizen, submit, psapAccept, revoke, capStatusFor, dossiers, escalations, log, mode };
}
