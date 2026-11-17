import test from 'node:test';
import assert from 'node:assert/strict';
import { nashFractions, runoff, reservoir, alarms, floodScenario, tsunamiEtaMin, tsunamiSpeed, tsunamiScenario } from '../src/flood-watch.mjs';

test('hidrograma de Nash: las fracciones suman 1 y la escorrentía conserva el volumen', () => {
  assert.ok(Math.abs(nashFractions(3, 60, 10).reduce((a, b) => a + b, 0) - 1) < 1e-4);
  const q = runoff([10, 0, 0], { areaKm2: 10, runoffCoef: 1, dtMin: 10, baseflow: 0 });
  assert.ok(Math.abs(q.reduce((a, b) => a + b, 0) * 600 - 100000) < 50); // 10 mm × 10 km² = 100 000 m³
});

test('embalse: lamina hasta llenarse y después vierte el exceso', () => {
  const r = reservoir(new Array(200).fill(300), { capacityHm3: 5, storageHm3: 4, outletM3s: 100, dtMin: 10 });
  assert.equal(Math.round(r.outflow[0]), 100); assert.ok(r.fill.at(-1) === 1); assert.ok(Math.abs(r.outflow.at(-1) - 300) < 1e-6);
});

test('riada sintética: la subida aguas arriba avisa ≥ 2 h antes del desbordamiento en pueblos donde casi no llueve', () => {
  const s = floodScenario();
  for (const t of s.result) { assert.ok(t.leadMin >= 120, `${t.name}: ${t.leadMin} min`); assert.ok(t.localRainMm < 10); }
  assert.ok(s.up.riseMin < s.up.thresholdMin);
});

test('alarma por subida: avisa antes que el umbral fijo en la misma serie', () => {
  const q = Array.from({ length: 60 }, (_, i) => 10 + Math.max(0, i - 20) ** 2);
  const a = alarms(q, { dtMin: 10, threshold: 800, risePerHour: 60 });
  assert.ok(a.riseMin < a.thresholdMin);
});

test('maremoto: c = √(g·h) y tiempos de llegada coherentes (aguas profundas ≈ 700 km/h)', () => {
  assert.ok(Math.abs(tsunamiSpeed(4000) * 3.6 - 713) < 2);
  assert.ok(Math.abs(tsunamiEtaMin([{ km: 198, depthM: 4000 }]) - 16.7) < 0.2);
  const s = tsunamiScenario(); assert.ok(s.coasts.every((c) => c.etaMin > 20 && c.etaMin < 90));
  assert.ok(s.people.every((p) => p.verticalMin < p.highGroundMin));
});
