import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWarning, createWarningBus, fromIncidentTwin, fromDatexHazard, fromFrameAssessment, fromCrashDetection, fromHotspotContext, fromZonePlan, planFanOut, v2vUpstreamDelivery, CHANNELS } from '../src/roadsafe-warning-bus.mjs';
import { roadAhead, geometryDirFromSentido } from '../src/roadsafe-horizon.mjs';
import { stats19RoadName, splitCsvLine, aadfLink, assignToLinks, rateEB, ratesByCategory } from '../src/roadsafe-exposure.mjs';
import { demoRoad, pointAt, roadLocate, encodeHazard, HAZARD } from '../src/road-guard.mjs';
import { assessHazardFrame, createFrameSigner, createTrustStore, signHazardCapsule } from '../src/roadsafe-frame-trust.mjs';

const now = 1_000_000;
const base = (o = {}) => ({ kind: 'STOPPED_VEHICLE_SHOULDER', lat: 40.2, lon: -3.3, roadId: 'A-3', dir: 1, validFrom: now, validUntil: now + 600, trust: 'UNVERIFIED_HINT', lineage: [{ source: 'TWIN', root: 'V16:B1' }], ...o });

test('aviso canónico: validación estricta (tipo, posición, validez, confianza, linaje)', () => {
  assert.throws(() => makeWarning(base({ kind: 'X' })), /tipo/); assert.throws(() => makeWarning(base({ lat: 99 })), /posición/);
  assert.throws(() => makeWarning(base({ validUntil: now })), /validez/); assert.throws(() => makeWarning(base({ trust: 'TOTAL' })), /confianza/);
  assert.throws(() => makeWarning(base({ lineage: [] })), /linaje/);
  assert.equal(makeWarning(base()).ceiling, 'ADVISORY'); assert.equal(makeWarning(base({ trust: 'OFFICIAL_FEED' })).ceiling, 'WARNING');
});

test('bus: escena única por familia/vía/sentido; dos raíces de multitud ⇒ CORROBORATED (nunca oficial); misma raíz no suma', () => {
  const bus = createWarningBus({ mergeM: 300 });
  const a = bus.ingest(makeWarning(base()), { now });
  assert.equal(bus.ingest(makeWarning(base({ lineage: [{ source: 'TWIN-2', root: 'V16:B1' }] })), { now: now + 1 }).independentRoots, 1, 'misma raíz (la V16 por otra vía)');
  assert.equal(bus.get(a.id).trust, 'UNVERIFIED_HINT');
  const m = bus.ingest(makeWarning(base({ kind: 'ACCIDENT', lat: 40.2008, lineage: [{ source: 'BLE', root: 'EVENT:9' }] })), { now: now + 2 });
  assert.equal(m.merged, true); assert.equal(bus.get(a.id).trust, 'CORROBORATED_CROWD'); assert.equal(bus.get(a.id).kind, 'ACCIDENT', 'el tipo más grave da el texto');
  assert.equal(bus.ingest(makeWarning(base({ dir: -1, lineage: [{ source: 'X', root: 'R2' }] })), { now }).merged, false, 'sentido contrario: otra escena');
  assert.equal(bus.ingest(makeWarning(base({ kind: 'FOG', lineage: [{ source: 'X', root: 'R3' }] })), { now }).merged, false, 'otra familia');
  assert.equal(bus.close(a.id, { now: now + 5, by: 'CITIZEN' }).ok, false); assert.equal(bus.close(a.id, { now: now + 5, by: 'OFFICIAL_FEED' }).ok, true);
  assert.ok(!bus.active(now + 6).some((w) => w.warningId === a.id));
});

test('normalizadores: gemelo, DATEX II (desconocido ⇒ informativo), BLE (rechazos fuera), detector (solo confirmado), punto negro (umbral declarado), cola', async () => {
  const tw = fromIncidentTwin({ id: 'RS-1', state: 'EMERGENCY_ESCALATION_REQUIRED', location: { lat: 40.2, lon: -3.3, roadId: 'A-3', dir: 1, lane: 'SHOULDER' }, confidence: { status: 'UNVERIFIED' }, sources: ['V16_BEACON'] }, { now });
  assert.equal(tw.kind, 'SECONDARY_COLLISION');
  assert.equal(fromDatexHazard({ id: 'd', type: null, lat: 40, lon: -3, confirmed: false }, { now }).kind, 'UNKNOWN_OFFICIAL');
  assert.equal(fromDatexHazard({ id: 'd', type: HAZARD.CRASH, lat: 40, lon: -3, confirmed: true }, { now }).trust, 'OFFICIAL_FEED');
  const fr = encodeHazard({ type: HAZARD.STOPPED, t: now, lat: 40.2, lon: -3.3, id: 5, flags: 0x01 });
  const signer = await createFrameSigner(), store = createTrustStore(); await store.enroll(signer.publicKey, { role: 'PEER_DEVICE' });
  const a = await assessHazardFrame(await signHazardCapsule(fr, signer), { now: now + 1, trustStore: store });
  const w = fromFrameAssessment(a, { now }); assert.equal(w.kind, 'SERVICE_STOPPING'); assert.equal(w.trust, 'SIGNED_PEER');
  assert.equal(fromFrameAssessment({ trust: 'REJECT_STALE' }, { now }), null);
  assert.equal(fromCrashDetection({ state: 'LIKELY_CRASH' }, { now, fix: { lat: 40, lon: -3 }, deviceRoot: 'd1' }), null, 'sin confirmación ni cuenta atrás vencida no se difunde');
  assert.equal(fromCrashDetection({ state: 'LIKELY_CRASH' }, { now, fix: { lat: 40, lon: -3 }, countdownExpired: true, deviceRoot: 'd1' }).kind, 'ACCIDENT');
  assert.throws(() => fromHotspotContext({ centroid: { lat: 40, lon: -3 }, cell: 'c' }, { now, severityP: 0.05 }), /minSeverityP/);
  assert.equal(fromHotspotContext({ centroid: { lat: 40, lon: -3 }, cell: 'c', ebExpected: 9 }, { now, severityP: 0.01, minSeverityP: 0.03 }), null);
  assert.equal(fromZonePlan({ queue: { forms: null } }, { now, tail: { lat: 40, lon: -3 } }), null, 'cola no calculada ⇒ sin aviso');
});

test('difusión: elegibilidad por autorización/consentimiento/confianza, contexto solo en la app, refuerzo por familias de fallo', () => {
  const w = { ...makeWarning(base({ trust: 'OFFICIAL_FEED' })), warningId: 'W-0000000000000001' };
  const none = planFanOut(w, { now });
  assert.deepEqual(none.rows.filter((r) => r.eligible).map((r) => r.channel).sort(), ['V2V_CARRY', 'VOICE_APP']);
  assert.equal(none.rows.find((r) => r.channel === 'SMS_GROUP').why, 'sin consentimiento del grupo/destinatario');
  const full = planFanOut(w, { now, authorizations: ['SIGNING_KEY', 'TRAFFIC_CENTRE_APPROVAL', 'DGT30_REGISTRATION_X509'], consents: ['SMS_GROUP'] });
  assert.ok(full.reinforcement.count >= 5); assert.equal(full.reinforcement.survivesCellularOutage, true);
  assert.equal(full.rows.find((r) => r.channel === 'VMS_PROPOSAL').payload.status, 'PROPOSED_FOR_OPERATOR_APPROVAL');
  assert.ok(Array.isArray(full.rows.find((r) => r.channel === 'BLE_CAPSULE').payload.frame));
  const hint = { ...makeWarning(base()), warningId: 'W-2' };
  assert.equal(planFanOut(hint, { now, authorizations: ['TRAFFIC_CENTRE_APPROVAL'] }).rows.find((r) => r.channel === 'VMS_PROPOSAL').eligible, false, 'una pista sin corroborar no va a paneles');
  const ctx = { ...makeWarning(base({ kind: 'HOTSPOT_CONTEXT', trust: 'OFFICIAL_FEED' })), warningId: 'W-3' };
  assert.deepEqual(planFanOut(ctx, { now, authorizations: ['TRAFFIC_CENTRE_APPROVAL', 'SIGNING_KEY'] }).rows.filter((r) => r.eligible).map((r) => r.channel), ['VOICE_APP']);
  assert.ok(Object.values(CHANNELS).every((c) => c.failureFamily && c.authorization));
});

test('vehículo a vehículo: parámetros obligatorios; más penetración ⇒ más probabilidad de entrega', () => {
  assert.throws(() => v2vUpstreamDelivery({ distanceM: 1000 }), /declararse/);
  const p = (pen) => v2vUpstreamDelivery({ distanceM: 3000, oppositeFlowVehH: 600, penetration: pen, contactProb: 0.5, vApproachMs: 25, vOppositeMs: 25, horizonS: 300 }).pDeliveredWithinHorizon;
  assert.ok(p(0.2) > p(0.05)); assert.equal(p(0), 0);
});

test('horizonte: delante, en mi sentido, dentro del horizonte; cola por su final; descartes explicados; parámetros obligatorios', () => {
  const { road } = demoRoad(), at = (s) => pointAt(road, s), p0 = at(3000), p1 = at(3030);
  const hdg = (Math.atan2((p1.lon - p0.lon) * Math.cos(p0.lat * Math.PI / 180), p1.lat - p0.lat) * 180 / Math.PI + 360) % 360;
  const fix = { ...p0, headingDeg: hdg, speedMs: 25 }, me = roadLocate(fix, road);
  const mk = (kind, s, dir, extra = {}) => ({ ...makeWarning({ kind, ...at(s), roadId: road.id, dir, validFrom: now, validUntil: now + 600, trust: 'OFFICIAL_FEED', lineage: [{ source: 'DATEX2:NAP', root: kind + s }], ...extra }), warningId: kind + s });
  const ws = [mk('ACCIDENT', 4500, me.dir), mk('QUEUE_TAIL', 4200, me.dir, { extentM: 300 }), mk('ACCIDENT', 4000, -me.dir), mk('ROADWORKS', 1000, me.dir), mk('FOG', 9000, null)];
  assert.throws(() => roadAhead(fix, road, ws, { now }), /declararse/);
  const r = roadAhead(fix, road, ws, { now, horizonM: 2000, horizonS: 120, maxOffRoadM: 30 });
  assert.deepEqual(r.items.map((i) => [i.kind, i.aheadM]), [['QUEUE_TAIL', 900], ['ACCIDENT', 1500]]);
  assert.deepEqual(r.dropped.map((d) => d.why).sort(), ['detrás', 'fuera del horizonte', 'sentido contrario']);
  assert.equal(r.items[0].etaS, 36);
  assert.equal(roadAhead({ lat: 41.5, lon: -1, headingDeg: 0, speedMs: 20 }, road, ws, { now, horizonM: 2000, horizonS: 120, maxOffRoadM: 30 }).onRoad, false);
});

test('exposición: nombres STATS19→AADF, CSV con comillas, tramo válido, asignación y Bayes empírico con exposición', () => {
  assert.deepEqual([stats19RoadName(1, 25), stats19RoadName(2, 1), stats19RoadName(3, 3111), stats19RoadName(6, 0)], ['M25', 'A1(M)', 'A3111', null]);
  assert.deepEqual(splitCsvLine('51,"South West","a,b"'), ['51', 'South West', 'a,b']);
  const L = (id, road, lat, aadf, len) => aadfLink({ count_point_id: id, road_name: road, road_category: 'PA', road_type: 'Major', latitude: String(lat), longitude: '-1', link_length_km: String(len), all_motor_vehicles: String(aadf), all_HGVs: '100' });
  assert.equal(aadfLink({ road_type: 'Minor', link_length_km: '1', all_motor_vehicles: '9', latitude: '1', longitude: '1' }), null);
  const links = [L('a', 'A1', 52.0, 20000, 2), L('b', 'A1', 52.1, 20000, 2), L('c', 'A2', 52.0, 1000, 0.5)];
  assert.throws(() => assignToLinks([], links, {}), /slackKm/);
  const recs = [...Array.from({ length: 12 }, () => ({ road: 'A1', lat: 52.0005, lon: -1, severity: 'SLIGHT' })), { road: 'A1', lat: 52.1, lon: -1, severity: 'FATAL' }, { road: 'A9', lat: 52, lon: -1, severity: 'SLIGHT' }, { road: null, lat: 52, lon: -1 }, { road: 'A2', lat: 53, lon: -1, severity: 'SLIGHT' }];
  const asg = assignToLinks(recs, links, { slackKm: 1 });
  assert.deepEqual([asg.assigned, asg.unassigned, asg.noRoad], [13, 2, 1]);
  const eb = rateEB(asg.perLink); assert.ok(eb.top[0].id === 'a' && eb.top[0].ebRate <= eb.top[0].rawRate + 1e-9);
  const cats = ratesByCategory(links, asg); assert.equal(cats[0].category, 'PA'); assert.ok(cats[0].injuryRate > 0);
});

test('sentido DGT (creciente/decreciente por PK) → sentido de la geometría; sin hitos no se adivina', () => {
  const { road } = demoRoad();
  assert.equal(geometryDirFromSentido(road, 'creciente'), 1, 'en la vía de demostración el PK crece con la geometría');
  assert.equal(geometryDirFromSentido(road, 'decreciente'), -1);
  assert.equal(geometryDirFromSentido({ ...road, milestones: [] }, 'creciente'), null);
  assert.equal(geometryDirFromSentido(road, 'norte'), null);
});
