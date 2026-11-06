import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIVE_CASES, MU, stoppingDistance, safeSpeedForVisibility, circumradius, curveSpeed, curveAhead, mountainRoad, wrongWayCheck, wrongWayMeet, shockwaveKmh, queueTail, queueWarning, fatigueRisk, floodedRoad, v16Fusion, detectRiderFall } from '../src/drive-cases.mjs';
import { pointAt, hazardRelevance, HAZARD } from '../src/road-guard.mjs';

test('catálogo: cada situación dice señal, acción, fuente, estado y permiso', () => {
  assert.ok(DRIVE_CASES.length >= 18);
  for (const c of DRIVE_CASES) { assert.ok(c.signal && c.action && c.source, c.id); assert.match(c.access, /^(PASIVO|CONVENIO)$/, c.id); }
});

test('frenado y visibilidad: con 50 m de niebla, 64 km/h en seco y 53 km/h en mojado; en hielo se para en más de 600 m a 120 km/h', () => {
  assert.equal(safeSpeedForVisibility(50).kmh, 64); assert.equal(safeSpeedForVisibility(50, { mu: MU.mojado }).kmh, 53);
  const s = safeSpeedForVisibility(80), d = stoppingDistance(s.vMs); assert.ok(Math.abs(d.totalM - 80) <= 1);
  assert.ok(stoppingDistance(33.3, { mu: MU.hielo }).totalM > 600);
});

test('curvas: radio exacto de la geometría y aviso de frenada antes de la horquilla', () => {
  assert.ok(Math.abs(circumradius({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }) - 50) < 1e-9);
  assert.equal(Math.floor(curveSpeed(100) * 3.6), 47);
  const r = mountainRoad();
  assert.equal(curveAhead(r, 600, 25).radiusM, 120);
  const h = curveAhead(r, 1100, 25); assert.equal(h.radiusM, 40); assert.equal(h.vMaxKmh, 30); assert.equal(h.level, 'FRENA');
  assert.equal(curveAhead(r, 0, 25).level, 'OK');
});

test('sentido contrario: tres posiciones contra el sentido de la calzada lo detectan; a favor, no; los demás reciben el tiempo hasta cruzarse', () => {
  const r = mountainRoad(), fx = (h) => [0, 1, 2, 3].map((k) => ({ ...pointAt(r, 300 - k * 25), headingDeg: h, speed: 25, t: k }));
  assert.equal(wrongWayCheck(fx(180), r).wrongWay, true);
  assert.equal(wrongWayCheck(fx(0), r).wrongWay, false);
  const m = wrongWayMeet({ distM: 800, vMeMs: 30, vOtherMs: 25 }); assert.equal(m.tS, 14.5); assert.equal(m.level, 'PELIGRO');
  const me = { lat: 40, lon: -3, headingDeg: 0 }, ahead = { lat: 40 + 500 / 111320, lon: -3, headingDeg: 180, type: HAZARD.WRONG_WAY, t: 0 };
  assert.equal(hazardRelevance(me, ahead, { now: 1 }).relevant, true);
});

test('retención: onda de choque de Lighthill-Whitham-Richards y punto donde alcanzarás la cola', () => {
  assert.equal(shockwaveKmh({ qUp: 1800, vUp: 100, qDown: 1200, vDown: 20 }), -14.3);
  assert.equal(queueTail([{ s: 0, vKmh: 100 }, { s: 1000, vKmh: 95 }, { s: 2000, vKmh: 15 }]).sTail, 2000);
  const w = queueWarning({ sMe: 0, vMeKmh: 110, sTail: 2000, wKmh: -14.3 }); assert.ok(w.meetDistM < 2000 && w.meetDistM > 1700);
});

test('fatiga, motoristas y agua', () => {
  assert.equal(fatigueRisk({ sinceBreakMin: 130, hour: 3 }).level, 'ALTO'); assert.equal(fatigueRisk({ sinceBreakMin: 40, hour: 11 }).level, 'BAJO');
  assert.equal(floodedRoad({ depthCm: 35 }).level, 'ARRASTRA_COCHE'); assert.match(floodedRoad({}).say, /^Da la vuelta/);
  const G = 9.80665, motion = [];
  for (let t = 0; t < 12; t += 0.05) motion.push(t < 5 ? { t, ax: 0, ay: 0, az: G } : Math.abs(t - 5) < 0.06 ? { t, ax: 4 * G, ay: 0, az: G } : { t, ax: G, ay: 0, az: 0 });
  const gps = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].map((t) => ({ t, speed: t < 5 ? 12 : 0 }));
  assert.match(detectRiderFall({ motion, gps }).state, /CRASH/);
});

test('V16 + SENDA: la baliza dice dónde; SENDA dice qué pasa; un choque sin V16 pide encenderla', () => {
  const r = v16Fusion([{ id: 'B1', lat: 40.2, lon: -3.3, t: 1000 }, { id: 'B2', lat: 40.5, lon: -3.6, t: 1000 }],
    [{ id: 'r1', lat: 40.2005, lon: -3.3005, t: 1050, kind: 'CRASH', injured: 2, trapped: 1, coordinator: 'Ana' }, { id: 'r2', lat: 41, lon: -3, t: 900, kind: 'CRASH' }]);
  assert.equal(r.incidents[0].kind, 'ACCIDENTE'); assert.equal(r.incidents[0].trapped, 1); assert.deepEqual(r.incidents[0].sources, ['V16', 'SENDA']);
  assert.equal(r.incidents[1].kind, 'VEHICULO_DETENIDO'); assert.equal(r.orphans[0].kind, 'ACCIDENTE_SIN_V16');
});
