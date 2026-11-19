import test from 'node:test';
import assert from 'node:assert/strict';
import { trackCircuitWatch, trackGeometryCrowd, speedTransitionAudit, weatherAssetWatch } from '../src/rail-watch.mjs';
import { syntheticTrackCircuit, syntheticPassengerTrips, runRailWatchDemo, DEMO_SPEED_PROFILE } from '../src/rail-watch-scenario.mjs';

test('patrón Adamuz: el escalón persistente por ENCIMA del umbral se detecta; el umbral absoluto no avisa', () => {
  const tc = syntheticTrackCircuit();
  const r = trackCircuitWatch(tc.samples, { occupancyThresholdV: tc.thresholdV });
  assert.equal(r.thresholdAlarms, 0);
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.ok(e.aboveOccupancyThreshold && !e.thresholdOnlyWouldAlarm && e.persistent && e.verdict === 'ESCALON_PERSISTENTE_INSPECCIONAR_VIA');
  assert.ok(e.detectedAtT - tc.stepAtS <= 3600, 'detectado en menos de 1 h');
});

test('circuito de vía: la ocupación por trenes y la deriva diaria NO generan falsas alarmas', () => {
  const tc = syntheticTrackCircuit({ stepV: 0 });
  assert.equal(trackCircuitWatch(tc.samples).events.length, 0);
});

test('circuito de vía: un escalón que se recupera se marca como transitorio', () => {
  const tc = syntheticTrackCircuit();
  const healed = tc.samples.map((s) => (s.t > tc.stepAtS + 1.5 * 3600 && !s.occupied ? { ...s, v: s.v + 0.7 } : s));
  assert.equal(trackCircuitWatch(healed).events[0].verdict, 'TRANSITORIO_REVISAR');
});

test('geometría colaborativa: encuentra el impacto repetido y el tramo que se degrada, sin confundir la zona lenta', () => {
  const r = trackGeometryCrowd(syntheticPassengerTrips());
  const at = (pk) => r.alerts.find((a) => a.fromPk <= pk && pk < a.toPk);
  assert.ok(at(7801)?.kinds.includes('IMPACTO_REPETIDO'));
  assert.ok(at(12400)?.kinds.includes('DEGRADACION'));
  assert.ok(!r.alerts.some((a) => a.fromPk >= 15000 && a.toPk <= 16000), 'la zona de velocidad reducida no es un defecto');
  assert.ok(r.alerts.length <= 4, `pocas alertas: ${r.alerts.length}`);
});

test('geometría colaborativa: un solo teléfono no basta (repetibilidad entre dispositivos)', () => {
  const one = syntheticPassengerTrips().filter((t) => t.deviceId === 'movil-0');
  assert.equal(trackGeometryCrowd(one).alerts.length, 0);
});

test('patrón Angrois: la bajada 200 → 80 sin supervisión continua encabeza la auditoría', () => {
  const a = speedTransitionAudit(DEMO_SPEED_PROFILE);
  assert.equal(a[0].risk, 'ALTO_SIN_SUPERVISION');
  assert.equal(a[0].energyRatio, 6.25);
  assert.ok(a.filter((x) => !x.supervised).length === 1);
});

test('patrón Gelida: muro en mal estado + lluvia + avisos del personal → propuesta de limitación', () => {
  const r = weatherAssetWatch([{ id: 'M', kind: 'MURO', pk: 1, condition: 4, daysSinceInspection: 600 }, { id: 'T', kind: 'TRINCHERA', pk: 2, condition: 1, daysSinceInspection: 30 }],
    { M: { mm24: 90, mm72: 150 }, T: { mm24: 90, mm72: 150 } }, { M: 2 });
  assert.equal(r[0].id, 'M'); assert.equal(r[0].level, 3);
  assert.ok(r[1].level < 3);
  assert.equal(weatherAssetWatch([{ id: 'M', kind: 'MURO', pk: 1, condition: 4, daysSinceInspection: 600 }], { M: { mm24: 5, mm72: 10 } })[0].level, 0);
});

test('demo completa determinista y con aviso de datos sintéticos', () => {
  const a = runRailWatchDemo(), b = runRailWatchDemo();
  assert.deepEqual(a, b);
  assert.ok(a.circuit.leadTimeH >= 20);
  assert.match(a.disclaimer, /sintéticos/);
});
