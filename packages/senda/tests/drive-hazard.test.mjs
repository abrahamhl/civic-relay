import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTracker, zoneOf, topAlert, theilSenSlope, RULES } from '../src/drive-hazard.mjs';
import { AASHTO_SSD } from '../src/road-guard.mjs';

const box = (cxv, s, label = 'car') => ({ label, score: 0.8, x: cxv - s / 2, y: 0.5 - s / 2, w: s, h: s });

test('el rojo usa el tiempo de percepción-reacción de AASHTO (con fuente)', () => {
  assert.equal(RULES.redTtcS, AASHTO_SSD.perceptionReactionS);
  assert.match(RULES.source, /no calibradas/);
});

test('zonas: izquierda, tu carril, derecha', () => {
  assert.equal(zoneOf(box(0.2, 0.1)), 'IZQUIERDA');
  assert.equal(zoneOf(box(0.5, 0.1)), 'TU_CARRIL');
  assert.equal(zoneOf(box(0.8, 0.1)), 'DERECHA');
});

test('coche delante acercándose: TTC por expansión del recuadro → rojo cuando baja de 2,5 s', () => {
  // Distancia D(t)=20-10t m (cierra a 10 m/s); tamaño aparente ∝ 1/D → TTC real = D/10.
  const tr = createTracker(); let last;
  for (let i = 0; i <= 15; i++) { const t = i * 0.1, D = 20 - 10 * t; last = tr.update([box(0.5, 2 / D)], t); }
  const o = last[0];
  assert.ok(Math.abs(o.ttcS - 0.5) < 0.35, `TTC estimado ${o.ttcS} frente a 0,5 s real`);
  assert.equal(o.level, 'ROJO');
});

test('coche que se aleja o va a tu misma velocidad: verde', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i <= 10; i++) last = tr.update([box(0.5, 0.1 - i * 0.002)], i * 0.1);
  assert.equal(last[0].level, 'VERDE');
  const tr2 = createTracker(); let l2;
  for (let i = 0; i <= 10; i++) l2 = tr2.update([box(0.5, 0.1)], i * 0.1);
  assert.equal(l2[0].ttcS, null);
});

test('coche a la derecha que se mete en tu carril: ámbar con motivo', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i <= 8; i++) last = tr.update([box(0.85 - i * 0.04, 0.12)], i * 0.1);
  assert.equal(last[0].level, 'AMBAR');
  assert.ok(last[0].reasons.some((r) => /derecha/.test(r)));
  assert.equal(topAlert(last).id, last[0].id);
});

test('seguimiento estable: dos coches distintos mantienen su identidad; objetos no vigilados se ignoran', () => {
  const tr = createTracker(); let last;
  for (let i = 0; i < 5; i++) last = tr.update([box(0.2, 0.1), box(0.8, 0.1), { label: 'traffic light', score: 0.9, x: 0.5, y: 0.1, w: 0.05, h: 0.1 }], i * 0.1);
  assert.equal(last.length, 2);
  assert.deepEqual(last.map((o) => o.id).sort(), [1, 2]);
  assert.equal(topAlert(last), null);
});

test('borde de imagen: coche entrando por la derecha (w recortado, h estable) NO da falso TTC', () => {
  const tr = createTracker();
  const ws = [0.066, 0.077, 0.091, 0.103, 0.111, 0.119];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i], out = tr.update([{ label: 'car', score: 0.65, x: 0.996 - w, y: 0.45, w, h: 0.188 - i * 0.001 }], i * 0.25);
    assert.equal(out[0].level, 'VERDE');
  }
});

test('pico aislado de 1 fotograma y desoclusión solo horizontal: sin falsa alarma', () => {
  const tr = createTracker();
  const seq = [
    { w: 0.084, h: 0.080 }, { w: 0.085, h: 0.079 }, { w: 0.082, h: 0.081 },
    { w: 0.092, h: 0.111 }, // pico de 1 fotograma
    { w: 0.082, h: 0.081 }, { w: 0.082, h: 0.080 },
  ];
  for (let i = 0; i < seq.length; i++) {
    const out = tr.update([{ label: 'truck', score: 0.5, x: 0.70, y: 0.45, ...seq[i] }], i * 0.25);
    assert.equal(out[0].level, 'VERDE');
  }
  // Desoclusión horizontal: w crece, h constante → VERDE
  const tr2 = createTracker();
  for (let i = 0; i < 6; i++) {
    const out = tr2.update([{ label: 'car', score: 0.6, x: 0.74, y: 0.45, w: 0.07 + i * 0.012, h: 0.105 }], i * 0.25);
    assert.equal(out[0].level, 'VERDE');
  }
  assert.equal(theilSenSlope([{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 2, v: 3 }, { t: 3, v: 10 }]), 2);
  assert.equal(theilSenSlope([{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 2, v: 3 }, { t: 3, v: 4 }, { t: 4, v: 10 }]), 1);
});

test('cadencia real de 4 Hz: incorporación rápida desde la derecha detectada sin perder la pista', () => {
  const tr = createTracker();
  let firstAmber = null;
  for (let i = 0; i <= 8; i++) {
    const t = i * 0.25;
    const out = tr.update([box(0.85 - 0.30 * t, 0.12)], t);
    if (out[0].level === 'AMBAR' && firstAmber === null) firstAmber = { t, id: out[0].id, reasons: out[0].reasons };
  }
  assert.ok(firstAmber !== null && firstAmber.t <= 1.0, `debió avisar en ≤ 1 s a 4 Hz, salió ${JSON.stringify(firstAmber)}`);
  assert.equal(firstAmber.id, 1);
  assert.ok(firstAmber.reasons.some((r) => /derecha/.test(r)));
});

test('parpadeo car/bus/truck del detector ligero mantiene una sola pista', () => {
  const tr = createTracker();
  const labels = ['car', 'bus', 'truck', 'truck', 'car'];
  const ids = new Set();
  labels.forEach((label, i) => {
    const out = tr.update([{ label, score: 0.5, x: 0.70, y: 0.45, w: 0.09, h: 0.08 }], i * 0.25);
    ids.add(out[0].id);
  });
  assert.equal(ids.size, 1);
});

test('regresión vídeo real Udacity MIT (145 fotogramas a 4 Hz, EfficientDet-Lite0): 0 falsas alarmas y ≤ 4 pistas', () => {
  const trace = JSON.parse(readFileSync(new URL('../calibration/udacity-effdet-4hz.json', import.meta.url), 'utf8'));
  assert.equal(trace.frames.length, 145);
  const tr = createTracker();
  const ids = new Set();
  let alerts = 0;
  for (const f of trace.frames) {
    const objs = tr.update(f.dets, f.t);
    objs.forEach((o) => ids.add(o.id));
    if (topAlert(objs)) alerts++;
  }
  assert.equal(alerts, 0, `esperado 0 falsas alarmas en el vídeo Udacity MIT (sin frenadas), medido ${alerts}`);
  assert.ok(ids.size <= 4, `esperado ≤ 4 pistas continuas (antes 10 fragmentos), medido ${ids.size}`);
});
