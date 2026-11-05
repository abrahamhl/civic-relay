import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLE_SOURCES, SRTI, vehicleEventToHazard, privacyGate, fuseSegmentSpeed, fusePosition, positionScenario, cameraToMeasured, dashcamToProbe } from '../src/vehicle-link.mjs';
import { HAZARD } from '../src/road-guard.mjs';
import { localFrame } from '../src/geo-offline.mjs';

test('fuentes: cada una con base legal y permiso; eCall y reidentificar vehículos son NUNCA; Ley de Datos por convenio', () => {
  for (const s of VEHICLE_SOURCES) { assert.ok(s.gives && s.legal && s.latency, s.id); assert.match(s.access, /^(PASIVO|CONVENIO|NUNCA)$/); }
  assert.equal(VEHICLE_SOURCES.find((s) => s.id === 'ecall').access, 'NUNCA');
  assert.equal(VEHICLE_SOURCES.find((s) => s.id === 'reidentificar').access, 'NUNCA');
  assert.match(VEHICLE_SOURCES.find((s) => s.id === 'data-act').legal, /2023\/2854/);
});

test('las 8 categorías SRTI de la UE y los eventos de coche se convierten en avisos SENDA', () => {
  assert.equal(Object.keys(SRTI).length, 8);
  assert.equal(vehicleEventToHazard({ type: 'conductor-sentido-contrario', lat: 40, lon: -3, t: 1 }).type, HAZARD.WRONG_WAY);
  assert.equal(vehicleEventToHazard({ type: 'AIRBAG_DEPLOYED', lat: 40, lon: -3, t: 1 }).prior, 0.8);
  assert.equal(vehicleEventToHazard({ type: 'ABS_ACTIVE', lat: 40, lon: -3, t: 1 }).type, HAZARD.ICE);
  assert.equal(vehicleEventToHazard({ type: 'RADIO_ON' }), null);
});

test('puerta de privacidad: solo celdas con k fuentes distintas, sin identificadores', () => {
  const obs = Array.from({ length: 7 }, (_, i) => ({ roadId: 'A-3', s: 1200 + i * 30, t: 100 + i, sourceId: `v${i}`, speedKmh: 40 + i }));
  obs.push({ roadId: 'A-3', s: 2600, t: 120, sourceId: 'z1', speedKmh: 90 }, { roadId: 'A-3', s: 2650, t: 130, sourceId: 'z1', speedKmh: 91 });
  const g = privacyGate(obs);
  assert.equal(g.published.length, 1); assert.equal(g.suppressedCells, 1); assert.equal(g.published[0].n, 7);
  assert.ok(!JSON.stringify(g.published).includes('v0'), 'no salen identificadores');
});

test('velocidad de un tramo: pesa más lo preciso y reciente; un dato ruidoso apenas mueve el resultado', () => {
  const r = fuseSegmentSpeed([{ source: 'telefono', kmh: 62, t: 0 }, { source: 'camaras', kmh: 58, t: 30 }, { source: 'detectores', kmh: 55, t: 60 }, { source: 'waze', kmh: 70, t: 60 }], { nowS: 60 });
  assert.ok(r.kmh > 55 && r.kmh < 59, String(r.kmh)); assert.ok(r.sdKmh < 3);
  assert.ok(r.contrib.find((c) => c.source === 'waze').gain < 0.1);
});

test('posición: con aerogenerador, Wi-Fi, otro coche y la vía, el error pasa de ~10 m (GNSS) a ~1-2 m', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = positionScenario({ seed }), f = localFrame(s.truth.lat, s.truth.lon), e = (p) => { const q = f.toXY(p.lat, p.lon); return Math.hypot(q.x, q.y); };
    const g = fusePosition([s.meas[0]]), a = fusePosition(s.meas);
    assert.ok(e(a) < 2.5 && e(a) < e(g) / 3, `semilla ${seed}: ${e(g).toFixed(1)} → ${e(a).toFixed(1)}`);
    assert.ok(a.rmsM < 1.5 && g.rmsM > 10);
  }
});

test('puentes con la visión: cámara fija → caudal; cámara a bordo → contactos de la calzada contraria y avisos', () => {
  assert.deepEqual(cameraToMeasured({ total: 2, durationS: 54, perMinute: 2.2 }).flowVehH, 133);
  const p = dashcamToProbe({ series: [{ t: 1, ttcS: 3.2 }, { t: 2, ttcS: 9 }, { t: 3, ttcS: null }], oncomingPerMin: 15, meanVisible: 1.2, leadShare: 0 });
  assert.equal(p.alerts.length, 1); assert.equal(p.alerts[0].type, HAZARD.BRAKE); assert.equal(p.oncomingPerMin, 15);
});
