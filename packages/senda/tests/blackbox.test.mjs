import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlackbox, parseJsonl, summarize, SCHEMA } from '../src/blackbox.mjs';

function clock(start = 1_700_000_000_000) { let t = start; return { now: () => t, step: (ms) => { t += ms; } }; }

test('caja negra: cabecera, tipos válidos y tiempos relativos', () => {
  const c = clock(); const bb = createBlackbox({ now: c.now, meta: { app: 'test' } });
  assert.equal(bb.rows[0].schema, SCHEMA); assert.equal(bb.rows[0].app, 'test');
  c.step(500); assert.equal(bb.add('gps', { lat: 39.47, lon: -0.38, v: 10, acc: 5 }), true);
  assert.equal(bb.add('inventado', {}), false);
  assert.equal(bb.rows.at(-1).t, 500);
});

test('caja negra: el IMU se limita a 10 Hz y el tamaño máximo descarta sin romper', () => {
  const c = clock(); const bb = createBlackbox({ now: c.now, limits: { maxRows: 4, gpsGapS: 3, imuHz: 10 } });
  assert.equal(bb.add('imu', { a: 1 }), true);
  c.step(50); assert.equal(bb.add('imu', { a: 2 }), false); // 50 ms < 100 ms
  c.step(60); assert.equal(bb.add('imu', { a: 3 }), true);
  c.step(200); assert.equal(bb.add('note', { text: 'x' }), true); // 4 filas con la cabecera
  assert.equal(bb.add('note', { text: 'y' }), false); assert.equal(bb.dropped, 1);
});

test('caja negra: JSONL ida y vuelta y rechazo de archivos ajenos', () => {
  const c = clock(); const bb = createBlackbox({ now: c.now });
  c.step(1000); bb.add('note', { text: 'hola' });
  const { rows, bad } = parseJsonl(bb.toJsonl() + '{roto\n');
  assert.equal(rows.length, 2); assert.equal(bad, 1);
  assert.throws(() => parseJsonl('{"k":"gps"}\n'), /no es una caja negra/);
});

test('resumen: distancia, huecos de GPS, detector y alertas por minuto salen del archivo', () => {
  const c = clock(); const bb = createBlackbox({ now: c.now });
  // 60 s a ~10 m/s hacia el norte con un hueco de GPS de 5 s
  for (let i = 0; i <= 60; i++) { if (i > 20 && i < 25) { c.step(1000); continue; } bb.add('gps', { lat: 39.47 + i * 10 / 111_320, lon: -0.38, v: 10, acc: 4 }); bb.add('det', { ms: 70 + (i % 3), be: 'CPU', n: 2 }); c.step(1000); }
  bb.add('alert', { level: 'AMBAR', label: 'car', zone: 'DERECHA', ttcS: 3.9 });
  bb.add('alert', { level: 'ROJO', label: 'car', zone: 'TU_CARRIL', ttcS: 2.1 });
  bb.add('bat', { level: 0.8, charging: false });
  const s = summarize(bb.rows);
  assert.equal(s.basis, 'MEDIDO_EN_ESTE_ARCHIVO');
  assert.ok(Math.abs(s.gps.distanceKm - 0.6) < 0.02, `distancia ${s.gps.distanceKm}`);
  assert.equal(s.gps.gapsOver3s, 1); assert.equal(s.gps.worstGaps[0].s, 5);
  assert.equal(s.gps.maxKmh, 36);
  assert.equal(s.detector.backends[0], 'CPU'); assert.ok(s.detector.msMean >= 70 && s.detector.msMean <= 72);
  assert.equal(s.alerts.rojo, 1); assert.equal(s.alerts.ambar, 1); assert.equal(s.alerts.perMin, 2);
  assert.equal(s.battery.startPct, 80);
});

test('resumen: fijos con mala precisión (> 50 m) no suman distancia', () => {
  const rows = [{ k: 'head', schema: SCHEMA, t0: 0 }, { k: 'gps', t: 0, lat: 39, lon: -0.4, acc: 5 }, { k: 'gps', t: 1000, lat: 39.01, lon: -0.4, acc: 300 }];
  assert.equal(summarize(rows).gps.distanceKm, 0);
});

test('resumen: barridos de señales (malla) sin identificadores', () => {
  const c = clock(); const bb = createBlackbox({ now: c.now });
  bb.add('radio', { wifiN: 12, bleN: 30, sendaNear: 0 }); c.step(30_000);
  bb.add('radio', { wifiN: 20, bleN: 8, sendaNear: 2 });
  const s = summarize(bb.rows);
  assert.deepEqual(s.radio, { scans: 2, wifiMax: 20, wifiMedian: 16, bleMax: 30, sendaMax: 2 });
});
