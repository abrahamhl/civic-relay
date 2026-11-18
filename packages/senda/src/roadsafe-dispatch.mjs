/**
 * SENDA RoadSafe · H-ROAD-3 — Orquestador federado de asistencia (sin falsa central de emergencias).
 *
 * SENDA no despacha grúas, taxis ni ambulancias: CONTACTA, a petición del afectado, con proveedores
 * con los que exista integración habilitada, y REGISTRA lo que esos proveedores CONFIRMAN.
 *
 * Contrato genérico de proveedor (adapter): request · acknowledge · updateStatus · cancel · handover · audit.
 * Estados de un servicio (separación estricta transporte ≠ negocio ≠ realidad física):
 *   DRAFT → SUBMITTED (HTTP enviado) → TRANSPORT_ACCEPTED (2xx: el servidor lo recibió, NADA MÁS)
 *   → PARTNER_ACKNOWLEDGED (el proveedor asigna referencia de expediente)
 *   → PARTNER_ASSIGNED (el proveedor declara recurso asignado) → EN_ROUTE_REPORTED (declarado por proveedor)
 *   → ON_SCENE_REPORTED (declarado) → ON_SCENE_CONFIRMED (proveedor + afectado u otra fuente independiente)
 *   → COMPLETED | CANCELLED | FAILED | HANDED_OVER | DELAYED (marca, no estado terminal)
 * Regla de oro: un 2xx NUNCA promueve más allá de TRANSPORT_ACCEPTED.
 *
 * Sin credenciales reales, se usa `createContractSimulator`: un banco de pruebas que respeta el
 * contrato y permite inyectar fallos (timeouts, 5xx, ACK sin referencia, estados fuera de orden,
 * duplicados), sin pretender ser ningún proveedor real.
 */

export const SERVICE_STATES = Object.freeze(['DRAFT', 'SUBMITTED', 'TRANSPORT_ACCEPTED', 'PARTNER_ACKNOWLEDGED', 'PARTNER_ASSIGNED', 'EN_ROUTE_REPORTED', 'ON_SCENE_REPORTED', 'ON_SCENE_CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED', 'HANDED_OVER']);
export const SERVICE_KINDS = Object.freeze(['ROADSIDE_ASSISTANCE', 'TOW', 'TAXI', 'REPLACEMENT_VEHICLE', 'INSURER_CLAIM']);
const ORDER = { DRAFT: 0, SUBMITTED: 1, TRANSPORT_ACCEPTED: 2, PARTNER_ACKNOWLEDGED: 3, PARTNER_ASSIGNED: 4, EN_ROUTE_REPORTED: 5, ON_SCENE_REPORTED: 6, ON_SCENE_CONFIRMED: 7, COMPLETED: 8 };
const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'FAILED', 'HANDED_OVER']);
/** Estados que SOLO puede declarar el proveedor (con referencia), nunca el transporte. */
const PARTNER_DECLARED = new Set(['PARTNER_ACKNOWLEDGED', 'PARTNER_ASSIGNED', 'EN_ROUTE_REPORTED', 'ON_SCENE_REPORTED', 'COMPLETED']);

/** Datos mínimos consentidos: solo los campos que el afectado autorizó salen hacia el proveedor. */
export function minimalPayload(incidentPublic, consent, extra = {}) {
  const allowed = new Set(consent?.fields ?? []);
  const base = { incidentId: incidentPublic.id, kind: incidentPublic.kind, location: incidentPublic.location };
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) if (allowed.has(k)) out[k] = v;
  return { payload: out, withheld: Object.keys(extra).filter((k) => !allowed.has(k)) };
}

/**
 * Banco de pruebas contractual de un proveedor. faults: { timeout, http5xx, ackWithoutRef, outOfOrder,
 * duplicateEvents, neverArrives, latencyS } — todo determinista para tests reproducibles.
 */
export function createContractSimulator({ providerId, kind, faults = {}, etaS = 1800 } = {}) {
  let seq = 0;
  const cases = new Map();
  return {
    providerId, kind, simulated: true,
    async request(payload, { now }) {
      if (faults.timeout) return { transport: 'TIMEOUT' };
      if (faults.http5xx) return { transport: 'HTTP', status: 503 };
      const ref = `${providerId}-SIM-${++seq}`;
      cases.set(ref, { payload, createdAt: now, status: 'RECEIVED' });
      return { transport: 'HTTP', status: 202, body: faults.ackWithoutRef ? {} : { reference: ref, simulated: true } };
    },
    /** Eventos que el proveedor emitiría (webhook) desde t0; el orquestador los consume. */
    eventsFor(ref, t0) {
      if (faults.neverArrives) return [{ at: t0 + 30, status: 'PARTNER_ASSIGNED', reference: ref }];
      const ev = [{ at: t0 + 30, status: 'PARTNER_ASSIGNED', reference: ref, etaS }, { at: t0 + 60, status: 'EN_ROUTE_REPORTED', reference: ref, etaS }, { at: t0 + etaS + (faults.latencyS ?? 0), status: 'ON_SCENE_REPORTED', reference: ref }];
      if (faults.outOfOrder) ev.unshift({ at: t0 + 10, status: 'COMPLETED', reference: ref });
      return faults.duplicateEvents ? ev.flatMap((e) => [e, { ...e }]) : ev;
    },
    async cancel(ref) { const c = cases.get(ref); if (!c) return { transport: 'HTTP', status: 404 }; c.status = 'CANCELLED'; return { transport: 'HTTP', status: 200 }; },
    async handover(ref, toProviderId) { const c = cases.get(ref); if (!c) return { transport: 'HTTP', status: 404 }; c.status = 'HANDED_OVER'; return { transport: 'HTTP', status: 200, body: { reference: ref, to: toProviderId } }; },
  };
}

/** Orquestador: mantiene los servicios de un expediente y su registro. */
export function createDispatchOrchestrator({ incidentId, auditSink = null } = {}) {
  const services = new Map(), log = [];
  const record = (e) => { log.push(e); auditSink?.(e); };
  const svc = (id) => services.get(id);

  async function request(adapter, { serviceId, kind, payload, now, slaS = 2700 }) {
    if (services.has(serviceId)) return { ok: true, idempotent: true, service: svc(serviceId) };
    if (!SERVICE_KINDS.includes(kind)) return { ok: false, error: 'tipo de servicio no válido' };
    const s = { serviceId, kind, providerId: adapter.providerId, simulated: !!adapter.simulated, state: 'SUBMITTED', reference: null, createdAt: now, slaS, etaS: null, history: [{ at: now, state: 'SUBMITTED', source: 'ORCHESTRATOR' }], flags: [] };
    services.set(serviceId, s);
    record({ at: now, op: 'REQUEST', serviceId, providerId: adapter.providerId, kind, simulated: s.simulated });
    let res;
    try { res = await adapter.request(payload, { now }); } catch (e) { res = { transport: 'ERROR', error: String(e?.message ?? e) }; }
    if (res.transport === 'HTTP' && res.status >= 200 && res.status < 300) {
      setState(s, 'TRANSPORT_ACCEPTED', now, 'TRANSPORT');
      // La referencia en la respuesta es un ACK del proveedor; sin ella no hay expediente.
      if (typeof res.body?.reference === 'string' && res.body.reference) { s.reference = res.body.reference; setState(s, 'PARTNER_ACKNOWLEDGED', now, 'PARTNER'); }
      else s.flags.push('ACK_SIN_REFERENCIA');
    } else {
      setState(s, 'FAILED', now, 'TRANSPORT'); s.flags.push(res.transport === 'TIMEOUT' ? 'TIMEOUT' : `TRANSPORTE_${res.status ?? res.transport}`);
    }
    record({ at: now, op: 'REQUEST_RESULT', serviceId, state: s.state, reference: s.reference, flags: [...s.flags] });
    return { ok: s.state !== 'FAILED', service: s };
  }

  function setState(s, state, at, source) { s.state = state; s.history.push({ at, state, source }); }

  /**
   * Evento de estado del proveedor (webhook autenticado por la capa de transporte).
   * Rechaza: referencia distinta, estados fuera de orden (salto atrás), terminales repetidos y duplicados.
   */
  function updateStatus(serviceId, { at, status, reference, etaS, authenticated = false }) {
    const s = svc(serviceId);
    if (!s) return { ok: false, error: 'servicio desconocido' };
    if (!authenticated) { record({ at, op: 'STATUS_REJECTED', serviceId, status, why: 'evento no autenticado' }); return { ok: false, error: 'evento no autenticado' }; }
    if (!PARTNER_DECLARED.has(status)) return { ok: false, error: `estado ${status} no declarable por el proveedor` };
    if (!s.reference || reference !== s.reference) { record({ at, op: 'STATUS_REJECTED', serviceId, status, why: 'referencia no coincide' }); return { ok: false, error: 'referencia no coincide' }; }
    if (TERMINAL.has(s.state)) return { ok: false, error: `servicio ya en estado terminal ${s.state}` };
    if (s.history.some((h) => h.state === status && h.at === at)) return { ok: true, duplicate: true };
    if (ORDER[status] <= ORDER[s.state]) { s.flags.push(`FUERA_DE_ORDEN_${status}`); record({ at, op: 'STATUS_REJECTED', serviceId, status, why: 'fuera de orden' }); return { ok: false, error: 'fuera de orden' }; }
    if (status === 'COMPLETED' && ORDER[s.state] < ORDER.ON_SCENE_REPORTED) { s.flags.push('COMPLETADO_SIN_LLEGADA'); record({ at, op: 'STATUS_REJECTED', serviceId, status, why: 'completado sin llegada declarada' }); return { ok: false, error: 'completado sin llegada declarada' }; }
    if (Number.isFinite(etaS)) s.etaS = etaS;
    setState(s, status, at, 'PARTNER');
    record({ at, op: 'STATUS', serviceId, status, reference });
    return { ok: true, state: s.state };
  }

  /** Llegada confirmada: exige la declaración del proveedor Y una confirmación independiente (afectado u otra fuente). */
  function confirmOnScene(serviceId, { at, by }) {
    const s = svc(serviceId);
    if (!s || s.state !== 'ON_SCENE_REPORTED') return { ok: false, error: 'el proveedor aún no declaró la llegada' };
    if (!['OWNER', 'EMERGENCY_SERVICE', 'OPERATOR'].includes(by)) return { ok: false, error: 'confirmación no independiente' };
    setState(s, 'ON_SCENE_CONFIRMED', at, by); record({ at, op: 'ON_SCENE_CONFIRMED', serviceId, by });
    return { ok: true };
  }

  async function cancel(adapter, serviceId, { now, reason }) {
    const s = svc(serviceId); if (!s || TERMINAL.has(s.state)) return { ok: false, error: 'no cancelable' };
    const res = s.reference ? await adapter.cancel(s.reference) : { transport: 'NONE' };
    const confirmed = res.transport === 'HTTP' && res.status >= 200 && res.status < 300;
    setState(s, 'CANCELLED', now, 'ORCHESTRATOR'); if (!confirmed) s.flags.push('CANCELACION_NO_CONFIRMADA_POR_PROVEEDOR');
    record({ at: now, op: 'CANCEL', serviceId, reason, providerConfirmed: confirmed });
    return { ok: true, providerConfirmed: confirmed };
  }

  /** Relevo: el servicio A pasa a HANDED_OVER solo si el nuevo proveedor B tiene ya su propio ACK con referencia. */
  async function handover(fromAdapter, serviceId, toAdapter, { now, newServiceId, payload }) {
    const s = svc(serviceId); if (!s || TERMINAL.has(s.state)) return { ok: false, error: 'servicio origen no activo' };
    const r = await request(toAdapter, { serviceId: newServiceId, kind: s.kind, payload, now, slaS: s.slaS });
    if (!r.ok || r.service.state !== 'PARTNER_ACKNOWLEDGED') { record({ at: now, op: 'HANDOVER_ABORTED', from: serviceId, to: newServiceId }); return { ok: false, error: 'el nuevo proveedor no confirmó: el servicio original sigue activo' }; }
    if (s.reference) await fromAdapter.handover(s.reference, toAdapter.providerId);
    setState(s, 'HANDED_OVER', now, 'ORCHESTRATOR'); s.handedTo = newServiceId;
    record({ at: now, op: 'HANDOVER', from: serviceId, to: newServiceId });
    return { ok: true };
  }

  /** Detección de retrasos y solicitudes atascadas (marca DELAYED; sugiere relevo, no lo ejecuta). */
  function checkDelays(now) {
    const alerts = [];
    for (const s of services.values()) {
      if (TERMINAL.has(s.state) || s.state === 'ON_SCENE_REPORTED' || s.state === 'ON_SCENE_CONFIRMED') continue;
      const age = now - s.createdAt;
      if (s.state === 'TRANSPORT_ACCEPTED' && age > 300) alerts.push({ serviceId: s.serviceId, issue: 'SIN_ACK_DE_PROVEEDOR', ageS: age, suggest: 'contactar por otro canal o proveedor alternativo' });
      else if (age > s.slaS) alerts.push({ serviceId: s.serviceId, issue: 'SLA_SUPERADO', ageS: age, suggest: 'proponer relevo al afectado' });
      else if (Number.isFinite(s.etaS) && age > s.etaS * 1.5 + 600) alerts.push({ serviceId: s.serviceId, issue: 'ETA_SUPERADA', ageS: age, suggest: 'pedir actualización al proveedor' });
    }
    for (const a of alerts) { const s = svc(a.serviceId); if (!s.flags.includes('DELAYED')) s.flags.push('DELAYED'); }
    return alerts;
  }

  /** Resumen verificable para el seguro: solo hechos con su fuente; nada inferido. */
  function insuranceSummary() {
    return {
      schema: 'senda-roadsafe-assistance-summary/1', incidentId,
      services: [...services.values()].map((s) => ({ serviceId: s.serviceId, kind: s.kind, providerId: s.providerId, simulated: s.simulated, reference: s.reference, finalState: s.state, flags: s.flags, timeline: s.history.map((h) => ({ at: h.at, state: h.state, source: h.source })) })),
      statement: 'Cada estado indica su fuente (TRANSPORT, PARTNER, OWNER…). TRANSPORT_ACCEPTED solo prueba la recepción técnica de la solicitud.',
      log: [...log],
    };
  }
  return { request, updateStatus, confirmOnScene, cancel, handover, checkDelays, insuranceSummary, services, log };
}
