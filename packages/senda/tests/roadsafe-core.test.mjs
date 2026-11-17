import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncident, observe, transition, tick, publicView, protectedView, verifyAudit, setAffected, allowedTransition, twinsFromObservations, INCIDENT_STATES } from '../src/roadsafe-incident-twin.mjs';
import { fuseRoadEvidence, correlateObservations, causalRoot } from '../src/roadsafe-correlation.mjs';
import { stoppingDistance, impactSpeed, shockwaveSpeed, secondaryRiskMC, warningDecision, wilson } from '../src/roadsafe-secondary-risk.mjs';
import { createDispatchOrchestrator, createContractSimulator, minimalPayload } from '../src/roadsafe-dispatch.mjs';
import { createEmergencyGateway, buildEmergencyDossier, call112Action } from '../src/roadsafe-emergency-gateway.mjs';
import { createMessage, recordAttempt, advance, routeChannels, deliveryLabel } from '../src/roadsafe-delivery.mjs';
import { toCifsIncident, validateCifs, cifsXml, toDatex2Situation, navigationLinks, semanticMapping, CAPABILITIES, CAPABILITY_CLASSES } from '../src/roadsafe-interop.mjs';
import { parseDatex2, toHazards } from '../src/datex2.mjs';
import { runExperiment, simulateOnce, PARAM_PROVENANCE } from '../src/roadsafe-accident-sim.mjs';

const v16 = (o = {}) => ({ obsId: 'v16-1', source: 'V16_BEACON', rootHint: 'B1', at: 0, lat: 40.2, lon: -3.3, accuracyM: 8, roadId: 'A-3', dir: 1, pk: 41.2, laneHint: 'SHOULDER', ...o });
const OWNER = { kind: 'OWNER', id: 'fam' }, TOW = { kind: 'PROVIDER', id: 'tow', verified: true }, OPS = { kind: 'OPERATOR', id: 'op', verified: true }, PSAP = { kind: 'EMERGENCY_SERVICE', id: '112', verified: true };

test('gemelo: V16 + su reflejo en DGT 3.0 + navegador NO corroboran; un conductor independiente + DATEX II sí', async () => {
  const inc = await createIncident(v16(), { now: 10, owner: { name: 'Familia X', phone: '+34000000000' } });
  assert.equal(inc.state, 'UNVERIFIED');
  await observe(inc, { obsId: 'dgt', source: 'DGT30_V16', rootHint: 'B1', at: 20, lat: 40.2, lon: -3.3 }, { now: 21 });
  await observe(inc, { obsId: 'nav', source: 'NAVIGATOR_FROM_DGT30', rootHint: 'B1', at: 30, lat: 40.2, lon: -3.3 }, { now: 31 });
  assert.equal(inc.confidence.independentRoots, 1); assert.equal(inc.state, 'UNVERIFIED', 'una sola raíz física');
  await observe(inc, { obsId: 'nap', source: 'DATEX2_NAP', at: 60, lat: 40.2, lon: -3.3 }, { now: 61 });
  assert.equal(inc.state, 'CORROBORATED');
  assert.equal((await observe(inc, { obsId: 'nap', source: 'DATEX2_NAP', at: 60, lat: 40.2, lon: -3.3 }, { now: 62 })).duplicate, true, 'idempotente');
});

test('gemelo: autoridades — HTTP/proveedor sin referencia, ciudadano que cierra una escalada, proveedor sin credencial', async () => {
  const inc = await createIncident(v16(), { now: 0 });
  assert.equal((await transition(inc, 'ASSISTANCE_REQUESTED', { actor: OWNER, now: 5 })).ok, true);
  assert.equal((await transition(inc, 'PARTNER_ACKNOWLEDGED', { actor: TOW, now: 6 })).ok, false, 'sin referencia');
  assert.equal((await transition(inc, 'PARTNER_ACKNOWLEDGED', { actor: { kind: 'PROVIDER' }, now: 6, reference: 'R1' })).ok, false, 'sin credencial');
  assert.equal((await transition(inc, 'PARTNER_ACKNOWLEDGED', { actor: TOW, now: 7, reference: 'R1', idempotencyKey: 'k1' })).ok, true);
  assert.equal((await transition(inc, 'PARTNER_ACKNOWLEDGED', { actor: TOW, now: 8, reference: 'R1', idempotencyKey: 'k1' })).idempotent, true);
  assert.equal((await transition(inc, 'SECONDARY_COLLISION_SUSPECTED', { actor: { kind: 'DEVICE' }, now: 900 })).ok, true);
  assert.equal((await transition(inc, 'EMERGENCY_ESCALATION_REQUIRED', { actor: OWNER, now: 901 })).ok, true);
  assert.equal((await transition(inc, 'RESOLVED', { actor: OWNER, now: 2000 })).ok, false, 'tras escalada solo un servicio verificado cierra');
  assert.equal((await transition(inc, 'RESOLVED', { actor: PSAP, now: 3000 })).ok, true);
  assert.equal((await transition(inc, 'UNVERIFIED', { actor: { kind: 'SYSTEM' }, now: 3001 })).ok, false, 'cerrado');
  const a = await verifyAudit(inc); assert.equal(a.ok, true);
  inc.audit[2].to = 'RESOLVED'; assert.equal((await verifyAudit(inc)).ok, false, 'manipulación detectada');
});

test('gemelo: caducidad STALE y reactivación; separación pública/protegida con auditoría de acceso', async () => {
  const inc = await createIncident(v16(), { now: 0, ttlS: 600, owner: { name: 'Familia X', phone: '+34000' } });
  await tick(inc, 700); assert.equal(inc.state, 'STALE');
  await observe(inc, { obsId: 'r2', source: 'SENDA_CITIZEN_REPORT', reporterId: 'u2', at: 710, lat: 40.2, lon: -3.3 }, { now: 711 });
  assert.equal(inc.state, 'UNVERIFIED');
  const pub = JSON.stringify(publicView(inc)); assert.doesNotMatch(pub, /Familia|\+34|u2/);
  assert.equal((await protectedView(inc, { actor: TOW, now: 720 })).ok, false, 'sin propósito');
  assert.equal((await protectedView(inc, { actor: { kind: 'CITIZEN' }, purpose: 'x', now: 720 })).ok, false);
  const pv = await protectedView(inc, { actor: TOW, purpose: 'remolque', now: 720 }); assert.equal(pv.view.owner.name, 'Familia X');
  assert.equal(inc.audit.at(-1).op, 'PROTECTED_ACCESS');
  assert.equal((await setAffected(inc, 'INJURIES_REPORTED', { actor: { kind: 'CITIZEN' }, now: 730 })).ok, false);
  assert.equal(INCIDENT_STATES.length, 11); assert.ok(allowedTransition('DISPUTED', 'CORROBORATED', 'OPERATOR'));
});

test('correlación: calzadas distintas no se fusionan; cerca y misma calzada sí; contradicción → DISPUTED', async () => {
  const g = correlateObservations([v16(), v16({ obsId: 'x', dir: -1, lat: 40.2003 }), v16({ obsId: 'y', source: 'SENDA_CITIZEN_REPORT', reporterId: 'u', at: 50, lat: 40.2005, accuracyM: 30 })]);
  assert.equal(g.length, 2);
  const f = fuseRoadEvidence([{ source: 'TRAFFIC_CENTRE_OPERATOR', at: 0, present: true }, { source: 'PROVIDER_STATUS', at: 10, present: false }], { now: 20 });
  assert.equal(f.status, 'DISPUTED');
  assert.equal(causalRoot({ source: 'NAVIGATOR_FROM_DGT30', rootHint: 'B1' }), 'V16_BEACON:B1');
  assert.equal(causalRoot({ source: 'SENDA_OWNER_DECLARATION', rootHint: 'B1' }), 'V16_BEACON:B1', 'el afectado y su V16 son la misma fuente');
  assert.equal(fuseRoadEvidence([{ source: 'V16_BEACON', at: 100 }], { now: 50 }).status, 'UNKNOWN', 'evidencia del futuro descartada');
  const twins = await twinsFromObservations([v16(), v16({ obsId: 'z', lat: 41 })], { now: 10 }); assert.equal(twins.length, 2);
});

test('física: distancia de parada, velocidad de impacto, onda de choque, Wilson', () => {
  assert.ok(Math.abs(stoppingDistance({ vMs: 25, reactS: 1.5, aEffMs2: 7 }) - (37.5 + 625 / 14)) < 1e-9);
  assert.equal(impactSpeed({ vMs: 25, reactS: 1, aEffMs2: 7, distM: 100 }), 0);
  assert.ok(impactSpeed({ vMs: 25, reactS: 1, aEffMs2: 7, distM: 40 }) > 0);
  assert.equal(impactSpeed({ vMs: 25, reactS: 2, aEffMs2: 7, distM: 40 }), 25, 'sin tiempo para frenar');
  assert.equal(shockwaveSpeed({ q1: 1800, k1: 20, q2: 0, k2: 150 }) < 0, true, 'la cola crece aguas arriba');
  assert.ok(Number.isNaN(stoppingDistance({ vMs: 25, reactS: 1, aEffMs2: 0 })));
  const [lo, hi] = wilson(5, 100); assert.ok(lo < 0.05 && hi > 0.05);
});

test('H-ROAD-1: Monte Carlo reproducible; aviso sin entrega = sin beneficio; política de ventana útil', () => {
  const base = { n: 2000, seed: 3, distToHazardM: 60, sightM: 60 };
  const a = secondaryRiskMC(base), b = secondaryRiskMC(base);
  assert.deepEqual(a, b, 'misma semilla, mismo resultado');
  const none = secondaryRiskMC({ ...base, warning: { leadS: 30, pDeliver: 0, pAccept: 1 } });
  assert.equal(none.pFailWithWarning, none.pFailNoWarning);
  const yes = secondaryRiskMC({ ...base, warning: { leadS: 30, pDeliver: 1, pAccept: 1, speedReduction: [0.1, 0.1] } });
  assert.ok(yes.pFailWithWarning < yes.pFailNoWarning);
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'SAME', posErrM: 10, timeToHazardS: 2, confidenceP: 0.99, risk: yes }).level, 'SUPPRESS', 'tardío');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'OPPOSITE', posErrM: 10, timeToHazardS: 30, confidenceP: 0.99, risk: yes }).level, 'SUPPRESS');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'SAME', posErrM: 10, timeToHazardS: 30, confidenceP: 0.99, risk: yes }).level, 'WARNING');
  assert.equal(warningDecision({ trustCeiling: 'ADVISORY', carriageway: 'SAME', posErrM: 10, timeToHazardS: 30, confidenceP: 0.99, risk: yes }).level, 'ADVISORY', 'techo de fuente sin firma');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'UNKNOWN', posErrM: 10, timeToHazardS: 30, confidenceP: 0.99, risk: yes }).level, 'ADVISORY');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'SAME', posErrM: 10, timeToHazardS: 30, confidenceP: 0.99, risk: none }).level, 'ADVISORY', 'sin beneficio demostrado');
  assert.equal(warningDecision({ trustCeiling: 'WARNING', carriageway: 'SAME', timeToHazardS: 30, confidenceP: NaN }).level, 'ABSTAIN');
});

test('H-ROAD-3: HTTP 2xx ≠ despacho; referencia obligatoria; eventos fuera de orden, sin autenticar y duplicados', async () => {
  const sim = createContractSimulator({ providerId: 'TOW-A', kind: 'TOW' }), orch = createDispatchOrchestrator({ incidentId: 'RS-1' });
  const { payload, withheld } = minimalPayload({ id: 'RS-1', kind: 'BREAKDOWN', location: { lat: 1, lon: 2 } }, { fields: ['plate'] }, { plate: '0000XXX', phone: '+34', policy: 'P-1' });
  assert.deepEqual(withheld.sort(), ['phone', 'policy']); assert.equal(payload.plate, '0000XXX');
  const r = await orch.request(sim, { serviceId: 's1', kind: 'TOW', payload, now: 0 });
  assert.equal(r.service.state, 'PARTNER_ACKNOWLEDGED'); assert.equal(r.service.simulated, true);
  const ref = r.service.reference;
  assert.equal(orch.updateStatus('s1', { at: 5, status: 'EN_ROUTE_REPORTED', reference: ref }).ok, false, 'no autenticado');
  assert.equal(orch.updateStatus('s1', { at: 5, status: 'EN_ROUTE_REPORTED', reference: 'otra', authenticated: true }).ok, false);
  assert.equal(orch.updateStatus('s1', { at: 5, status: 'COMPLETED', reference: ref, authenticated: true }).ok, false, 'completado sin llegada');
  assert.equal(orch.updateStatus('s1', { at: 6, status: 'EN_ROUTE_REPORTED', reference: ref, authenticated: true }).ok, true);
  assert.equal(orch.updateStatus('s1', { at: 7, status: 'PARTNER_ASSIGNED', reference: ref, authenticated: true }).ok, false, 'salto atrás');
  assert.equal(orch.confirmOnScene('s1', { at: 8, by: 'OWNER' }).ok, false, 'el proveedor aún no declaró llegada');
  orch.updateStatus('s1', { at: 900, status: 'ON_SCENE_REPORTED', reference: ref, authenticated: true });
  assert.equal(orch.confirmOnScene('s1', { at: 901, by: 'PROVIDER' }).ok, false, 'confirmación no independiente');
  assert.equal(orch.confirmOnScene('s1', { at: 902, by: 'OWNER' }).ok, true);
  const t = await orch.request(createContractSimulator({ providerId: 'X', kind: 'TOW', faults: { timeout: true } }), { serviceId: 's2', kind: 'TOW', payload, now: 0 });
  assert.equal(t.service.state, 'FAILED');
  const noRef = await orch.request(createContractSimulator({ providerId: 'Y', kind: 'TAXI', faults: { ackWithoutRef: true } }), { serviceId: 's3', kind: 'TAXI', payload, now: 0 });
  assert.equal(noRef.service.state, 'TRANSPORT_ACCEPTED', '202 sin referencia no es un expediente');
  assert.ok(orch.checkDelays(400).some((d) => d.issue === 'SIN_ACK_DE_PROVEEDOR'));
  const sum = orch.insuranceSummary(); assert.equal(sum.services.length, 3); assert.ok(sum.services[0].timeline.every((h) => h.source));
});

test('H-ROAD-3: relevo solo si el nuevo proveedor confirma; cancelación sin confirmación queda marcada', async () => {
  const a = createContractSimulator({ providerId: 'TAXI-A', kind: 'TAXI' }), bad = createContractSimulator({ providerId: 'TAXI-B', kind: 'TAXI', faults: { http5xx: true } }), b = createContractSimulator({ providerId: 'TAXI-C', kind: 'TAXI' });
  const orch = createDispatchOrchestrator({ incidentId: 'RS-2' });
  await orch.request(a, { serviceId: 't1', kind: 'TAXI', payload: {}, now: 0 });
  assert.equal((await orch.handover(a, 't1', bad, { now: 10, newServiceId: 't2', payload: {} })).ok, false);
  assert.equal(orch.services.get('t1').state, 'PARTNER_ACKNOWLEDGED', 'el original sigue activo');
  assert.equal((await orch.handover(a, 't1', b, { now: 20, newServiceId: 't3', payload: {} })).ok, true);
  assert.equal(orch.services.get('t1').state, 'HANDED_OVER');
  const c = await orch.request(createContractSimulator({ providerId: 'Z', kind: 'TOW', faults: { ackWithoutRef: true } }), { serviceId: 'c1', kind: 'TOW', payload: {}, now: 0 });
  const k = await orch.cancel(a, 'c1', { now: 5, reason: 'resuelto' }); assert.equal(k.providerConfirmed, false); assert.ok(c.service.flags.includes('CANCELACION_NO_CONFIRMADA_POR_PROVEEDOR'));
});

test('pasarela 112: nunca automática, modo TEST no toca servicios reales, PSAP verificado, dedupe, TTL y revocación', async () => {
  assert.equal(call112Action().automatic, false); assert.equal(call112Action().href, 'tel:112');
  const real = { id: 'psap-real', kind: 'PSAP', agreementRef: null, institutionalAuth: false, send: async () => { throw new Error('NO DEBE LLAMARSE'); } };
  let simCalls = 0; const sim = { id: 'sim', kind: 'SIMULATOR', send: async () => { simCalls++; return { transport: 'HTTP', status: 202 }; } };
  const gw = createEmergencyGateway({ endpoints: [real, sim], mode: 'TEST' });
  const inc = { id: 'RS-9', kind: 'BREAKDOWN', state: 'SECONDARY_COLLISION_SUSPECTED', location: { lat: 40.2, lon: -3.3, roadId: 'A-3', pk: 41.2, dir: 1, accuracyM: 8, lane: 'SHOULDER' }, confidence: null };
  const d = gw.register(buildEmergencyDossier(inc, { now: 0, ttlS: 600, scene: { vehicles: 3, people: 5, v16Active: true } }));
  assert.equal(d.status, 'Exercise'); assert.match(d.script, /alcance/); assert.match(d.script, /PK|kilométrico 41.2/);
  assert.equal((await gw.submit(d.dossierId, 'psap-real', { now: 1 })).ok, false);
  assert.equal((await gw.submit(d.dossierId, 'sim', { now: 2 })).state, 'TECHNICAL_RECEIPT'); assert.equal(simCalls, 1);
  assert.equal(gw.psapAccept(d.dossierId, { now: 3, psapReference: 'X', actor: { kind: 'OPERATOR', verified: true } }).ok, false);
  assert.equal(gw.psapAccept(d.dossierId, { now: 4, psapReference: '', actor: PSAP }).ok, false);
  assert.equal(gw.psapAccept(d.dossierId, { now: 5, psapReference: '112-ABC', actor: PSAP }).ok, true);
  assert.equal(gw.escalate('RS-9', { now: 10, reason: 'alcance', dossier: d }).deduped, false);
  assert.equal(gw.escalate('RS-9', { now: 20, reason: 'segundo aviso' }).deduped, true);
  const d2 = gw.register(buildEmergencyDossier(inc, { now: 100, ttlS: 50 }));
  assert.equal(gw.showToCitizen(d2.dossierId, { now: 200 }).ok, false, 'caducado'); assert.equal(d2.state, 'EXPIRED');
  const d3 = gw.register(buildEmergencyDossier(inc, { now: 300 })); gw.revoke(d3.dossierId, { now: 301, reason: 'error' });
  assert.equal((await gw.submit(d3.dossierId, 'sim', { now: 302 })).ok, false);
  assert.equal(gw.capStatusFor({ actor: OWNER, exercise: false }), null); assert.equal(gw.capStatusFor({ exercise: true }), 'Exercise');
  assert.equal(createEmergencyGateway({ endpoints: [{ ...real, agreementRef: 'A', institutionalAuth: true }], mode: 'TEST' }).mode, 'TEST');
});

test('entrega: fallo de conexión no es envío; custodia ≠ destino; DESTINATION_ACK exige acuse; caducidad', () => {
  const m = createMessage({ id: 'm1', now: 0, ttlS: 100 });
  recordAttempt(m, { at: 1, channel: 'CELLULAR_DATA', outcome: 'CONNECTION_FAILED' }); assert.equal(m.state, 'QUEUED');
  recordAttempt(m, { at: 2, channel: 'DTN_RELAY', outcome: 'HANDED_TO_CUSTODIAN' }); assert.equal(m.state, 'CUSTODY_ACK');
  assert.equal(advance(m, 'DESTINATION_ACK', { at: 3 }).ok, false);
  recordAttempt(m, { at: 4, channel: 'DTN_RELAY', outcome: 'SENT_NO_ACK' }); assert.equal(m.state, 'FORWARDED_UNCONFIRMED');
  assert.equal(advance(m, 'DESTINATION_ACK', { at: 500, evidence: { destinationAck: true } }).ok, false); assert.equal(m.state, 'EXPIRED');
  assert.doesNotMatch(deliveryLabel('FORWARDED_UNCONFIRMED'), /recibido/i); assert.match(deliveryLabel('QUEUED', 'nl'), /wachtrij/);
  const r = routeChannels({ available: ['CELLULAR_DATA', 'SMS', 'BLE_PEER', 'SATELLITE_SOS', 'DGT30_PLATFORM', 'PARTNER_API'], consents: ['location_share', 'ble_beacon', 'partner_share'], authorizations: [], receipts: { CELLULAR_DATA: { successes: 2, failures: 8 } } });
  assert.deepEqual(r.rejected.map((x) => x.channel).sort(), ['DGT30_PLATFORM', 'PARTNER_API', 'SATELLITE_SOS', 'SMS']);
  assert.ok(r.plan.find((x) => x.channel === 'CELLULAR_DATA').pLower < 0.6, 'la fiabilidad medida baja la prioridad');
});

test('interop: CIFS válido para vehículo en arcén, ida y vuelta DATEX II, enlaces y registro de capacidades', () => {
  const inc = { id: 'RS-abc', kind: 'BREAKDOWN', state: 'CORROBORATED', location: { lat: 40.2, lon: -3.3, roadId: 'A-3', dir: 1, pk: 41.2, lane: 'SHOULDER' }, confidence: { status: 'CORROBORATED', p: 0.97 } };
  const c = toCifsIncident(inc, { nowMs: Date.parse('2026-11-17T10:00:00Z') });
  assert.equal(c.subtype, 'HAZARD_ON_SHOULDER_CAR_STOPPED'); assert.equal(c.starttime, '2026-11-17T10:00:00+00:00');
  assert.equal(validateCifs(c).valid, true); assert.equal(validateCifs(c).publishable, false);
  assert.match(cifsXml([c]), /<incident id="senda-RS-abc">/);
  assert.equal(validateCifs({ ...c, polyline: '40.2' }).valid, false); assert.equal(validateCifs({ ...c, direction: 'NORTH' }).valid, false);
  const back = toHazards(parseDatex2(toDatex2Situation(inc, { nowIso: '2026-11-17T10:00:00Z' })));
  assert.equal(back.length, 1); assert.equal(back[0].road, 'A-3'); assert.equal(back[0].confirmed, true);
  assert.match(navigationLinks({ lat: 40.2, lon: -3.3 }).google, /api=1/);
  assert.ok(CAPABILITIES.every((x) => CAPABILITY_CLASSES.includes(x.class) && x.evidence));
  assert.equal(CAPABILITIES.find((x) => x.id === 'GMAPS_INCIDENT_INJECTION').class, 'NOT_SUPPORTED');
  assert.equal(semanticMapping({ ...inc, state: 'SECONDARY_COLLISION_SUSPECTED' }).denm.causeCode, 92);
});

test('simulador del caso: reproducible, controles negativos y separación de parámetros', () => {
  const a = runExperiment({ n: 400, seed: 5 }), b = runExperiment({ n: 400, seed: 5 });
  assert.deepEqual(a, b);
  const z = runExperiment({ n: 400, seed: 5, overrides: { shareOverride: { SENDA_APP: 0, DGT30_NAVIGATOR: 0 } } }).summary;
  assert.equal(z.D_SENDA_VERIFIED.pCollision, z.A_NO_DIGITAL.pCollision, 'adopción cero = sin efecto');
  const pl = runExperiment({ n: 400, seed: 5, overrides: { placebo: true } }).summary;
  assert.equal(pl.D_SENDA_VERIFIED.pCollision, pl.A_NO_DIGITAL.pCollision, 'placebo = sin efecto');
  assert.equal(a.summary.B_V16_INFORMATIVE.pCollision, a.summary.A_NO_DIGITAL.pCollision, 'la V16 informativa no se asume entregada al conductor');
  assert.equal(a.summary.D_SENDA_VERIFIED.confirmedDisplayAck, 0);
  assert.ok(Object.values(PARAM_PROVENANCE).every((p) => ['MEASURED', 'LITERATURE_RANGE', 'HYPOTHETICAL', 'UNKNOWN_SWEPT'].includes(p.provenance)));
  assert.ok(!Object.values(PARAM_PROVENANCE).some((p) => p.provenance === 'MEASURED'), 'no hay medidas del caso: nada se etiqueta como medido');
  const hit = simulateOnce({ speedKmh: 100, headwayS: 0.5, reactUnexpectedS: 1.5, reactExpectedS: 0.7, mu: 0.4, brakeEff: 0.85, taxiDecelMs2: 5, gapTaxiVanM: 3, sightM: 250, restitution: 0.1, massKg: { taxi: 1600, follower: 1500 }, taxiPostBrake: 0.6, speedReduction: 0, lateWarningPenaltyS: 0, warned: false });
  assert.equal(hit.collision, true); assert.equal(hit.secondary, true, 'cadena completa: alcance y empuje contra la furgoneta');
});
