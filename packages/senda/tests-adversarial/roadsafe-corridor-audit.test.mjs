/**
 * Auditoría RoadSafe de corridor-connectors / corridor-fabric (pendiente desde la iteración I, P2-3).
 * Cada prueba reproduce un defecto verificado y exige el comportamiento corregido.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeObservation, parseNdwDatexPayload, parseDgtNapXml, createMqttEdgeBridge, correlateCorridorObservations, CorridorTransportFabric } from '../src/corridor-fabric.mjs';

const nowMs = Date.parse('2026-11-18T01:00:00Z');
const raw = { sourceId: 'X', observationType: 'T', units: 'u', value: 1, measuredAtUtc: '2026-11-18T00:59:00Z', location: { lat: 40, lon: -3 } };

test('C1: normalizeObservation no afirma validación ni verificación que no ocurrieron, ni inventa confianza o radio', () => {
  const o = normalizeObservation(raw, { nowMs });
  assert.deepEqual(o.qualityFlags, ['UNVALIDATED']); assert.equal(o.provenance.verificationState, 'UNVERIFIED');
  assert.equal(o.confidence, null); assert.equal(o.location.uncertaintyRadiusM, null); assert.equal(o.measurementUncertainty, null);
});

test('C2: NDW — estación MONIBAS no reconocida se descarta (antes coordenadas inventadas); sin nivel de evidencia ⇒ sin confianza', () => {
  const xml = '<d2LogicalModel xmlns="http://datex2.eu/schema/2/2_0"><siteMeasurements><measurementSiteReference id="RWS99_DESCONOCIDA"/><measurementTimeDefault>2026-11-18T00:58:00Z</measurementTimeDefault><speed>88</speed></siteMeasurements></d2LogicalModel>';
  const r = parseNdwDatexPayload(xml, { nowMs, receivedAtUtc: '2026-11-18T01:00:00Z' });
  assert.equal(r.observations.length, 0); assert.equal(r.missingDataCount, 1);
  const v3 = '<x xmlns:sit="http://datex2.eu/schema/3/situation"><sit:situation id="s"><sit:situationRecord id="r" xsi:type="sit:VehicleObstruction"><sit:situationRecordVersionTime>2026-11-18T00:58:00Z</sit:situationRecordVersionTime><loc:latitude>52.0</loc:latitude><loc:longitude>5.9</loc:longitude></sit:situationRecord></sit:situation></x>';
  const o = parseNdwDatexPayload(v3, { nowMs, receivedAtUtc: '2026-11-18T01:00:00Z' }).observations[0];
  assert.equal(o.confidence, null); assert.ok(o.qualityFlags.includes('DATEX2_V3_PARSED_NOT_SCHEMA_VALIDATED'));
});

test('C3: DGT NAP — sin gravedad ni carretera no se inventan; registros suspendidos no cuentan', () => {
  const mk = (status) => `<p xmlns="http://datex2.eu/schema/3/"><sit:situation id="d1"><sit:situationRecord xsi:type="sit:Accident"><sit:situationRecordVersionTime>2026-11-18T00:58:00Z</sit:situationRecordVersionTime>${status ? `<com:validityStatus>${status}</com:validityStatus>` : ''}<loc:latitude>40.2</loc:latitude><loc:longitude>-3.3</loc:longitude></sit:situationRecord></sit:situation></p>`;
  const o = parseDgtNapXml(mk(null), { nowMs, receivedAtUtc: '2026-11-18T01:00:00Z' }).observations[0];
  assert.equal(o.value.severity, null); assert.equal(o.roadSegmentId, null); assert.equal(o.confidence, null);
  assert.equal(parseDgtNapXml(mk('suspended'), { nowMs, receivedAtUtc: '2026-11-18T01:00:00Z' }).observations.length, 0);
});

test('C4: MQTT — sin token por defecto en el código; tokens cortos rechazados; detecciones no inventadas', async () => {
  assert.throws(() => createMqttEdgeBridge({}), /no hay token por defecto/);
  assert.throws(() => createMqttEdgeBridge({ authorizedTokens: ['corto'] }), /16 caracteres/);
  const b = createMqttEdgeBridge({ authorizedTokens: ['token-largo-de-pruebas-0001'] });
  await assert.rejects(b.authenticate({ token: 'edge-token-barrio-lab-01' }), /no autorizado/, 'el antiguo token por defecto ya no abre nada');
  const r = await b.fetchObservation({ token: 'token-largo-de-pruebas-0001', eventPayload: { schema: 'senda.edge-event/1.0', measuredAtUtc: '2026-11-18T00:59:30Z', location: { lat: 40, lon: -3 } }, nowMs });
  assert.equal(r.observation.value.objectClass, 'UNSPECIFIED'); assert.equal(r.observation.value.severityScore, null); assert.equal(r.observation.confidence, null);
});

test('C5: fusión del corredor — sin confianza declarada no se mueve la probabilidad; la banda se declara heurística', () => {
  const o = normalizeObservation({ ...raw, observationType: 'STATIONARY_VEHICLE_OBSTRUCTION', roadSegmentId: 'S1' }, { nowMs });
  const r = correlateCorridorObservations([o], { nowMs });
  const ev = r.events[0];
  assert.match(ev.uncertaintyIntervalBasis, /HEURISTIC/); assert.match(ev.basis, /UNCALIBRATED/);
  assert.ok(ev.explainability.every((e) => e.deltaLogOdds === 0)); assert.equal(ev.location.uncertaintyRadiusM, null);
});

test('C6: un canal registrado sin autorización declarada no queda autorizado', () => {
  const f = new CorridorTransportFabric();
  f.registerBearer({ bearerId: 'B1', type: 'CELLULAR_BACKHAUL', observedCoverage: true });
  assert.equal(f.bearers.get('B1').authorizationState, 'UNVERIFIED');
});
