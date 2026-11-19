import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIVE_CASES, EXAMPLE_MU, EXAMPLE_DRIVER, EXAMPLE_CURVE, EXAMPLE_WRONG_WAY, EXAMPLE_QUEUE, EXAMPLE_FATIGUE, EXAMPLE_RIDER_FALL, EXAMPLE_V16_FUSION, EXAMPLE_MOUNTAIN_ROAD, NWS_FLOOD_CM, stoppingDistance, safeSpeedForVisibility, circumradius, curveSpeed, curveAhead, mountainRoad, wrongWayCheck, wrongWayMeet, shockwaveKmh, queueTail, queueWarning, fatigueRisk, floodedRoad, v16Fusion, detectRiderFall } from '../src/drive-cases.mjs';
import { pointAt, hazardRelevance, HAZARD, EXAMPLE_RELEVANCE, AASHTO_SSD } from '../src/road-guard.mjs';

// Escenarios DECLARADOS (regla de veracidad): seco y mojado de EXAMPLE_MU, conductor de EXAMPLE_DRIVER.
const DRY = { mu: EXAMPLE_MU.seco, ...EXAMPLE_DRIVER }, WET = { ...DRY, mu: EXAMPLE_MU.mojado }, ICE = { ...DRY, mu: EXAMPLE_MU.hielo };
const MR = () => mountainRoad(EXAMPLE_MOUNTAIN_ROAD);

test('catálogo: cada situación dice señal, acción, fuente, estado y permiso', () => {
  assert.ok(DRIVE_CASES.length >= 18);
  for (const c of DRIVE_CASES) { assert.ok(c.signal && c.action && c.source, c.id); assert.match(c.access, /^(PASIVO|CONVENIO)$/, c.id); }
});

test('frenado y visibilidad: con 50 m de niebla, 64 km/h en seco y 53 km/h en mojado; en hielo se para en más de 600 m a 120 km/h', () => {
  assert.equal(safeSpeedForVisibility(50, DRY).kmh, 64); assert.equal(safeSpeedForVisibility(50, WET).kmh, 53);
  const s = safeSpeedForVisibility(80, DRY), d = stoppingDistance(s.vMs, DRY); assert.ok(Math.abs(d.totalM - 80) <= 1);
  assert.ok(stoppingDistance(33.3, ICE).totalM > 600);
});

test('curvas: radio exacto de la geometría y aviso de frenada antes de la horquilla', () => {
  assert.ok(Math.abs(circumradius({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }) - 50) < 1e-9);
  assert.equal(Math.floor(curveSpeed(100, EXAMPLE_CURVE) * 3.6), 47);
  const r = MR();
  assert.equal(curveAhead(r, 600, 25, EXAMPLE_CURVE).radiusM, 120);
  const h = curveAhead(r, 1100, 25, EXAMPLE_CURVE); assert.equal(h.radiusM, 40); assert.equal(h.vMaxKmh, 30); assert.equal(h.level, 'FRENA');
  assert.equal(curveAhead(r, 0, 25, EXAMPLE_CURVE).level, 'OK');
});

test('sentido contrario: tres posiciones contra el sentido de la calzada lo detectan; a favor, no; los demás reciben el tiempo hasta cruzarse', () => {
  const r = MR(), fx = (h) => [0, 1, 2, 3].map((k) => ({ ...pointAt(r, 300 - k * 25), headingDeg: h, speed: 25, t: k }));
  assert.equal(wrongWayCheck(fx(180), r, EXAMPLE_WRONG_WAY).wrongWay, true);
  assert.equal(wrongWayCheck(fx(0), r, EXAMPLE_WRONG_WAY).wrongWay, false);
  const m = wrongWayMeet({ distM: 800, vMeMs: 30, vOtherMs: 25 }, EXAMPLE_WRONG_WAY); assert.equal(m.tS, 14.5); assert.equal(m.level, 'PELIGRO');
  const me = { lat: 40, lon: -3, headingDeg: 0 }, ahead = { lat: 40 + 500 / 111320, lon: -3, headingDeg: 180, type: HAZARD.WRONG_WAY, t: 0 };
  assert.equal(hazardRelevance(me, ahead, { ...EXAMPLE_RELEVANCE, now: 1 }).relevant, true);
});

test('retención: onda de choque de Lighthill-Whitham-Richards y punto donde alcanzarás la cola', () => {
  assert.equal(shockwaveKmh({ qUp: 1800, vUp: 100, qDown: 1200, vDown: 20 }), -14.3);
  assert.equal(queueTail([{ s: 0, vKmh: 100 }, { s: 1000, vKmh: 95 }, { s: 2000, vKmh: 15 }], EXAMPLE_QUEUE).sTail, 2000);
  const w = queueWarning({ sMe: 0, vMeKmh: 110, sTail: 2000, wKmh: -14.3 }); assert.ok(w.meetDistM < 2000 && w.meetDistM > 1700);
});

test('fatiga, motoristas y agua', () => {
  assert.equal(fatigueRisk({ sinceBreakMin: 130, hour: 3 }, EXAMPLE_FATIGUE).level, 'ALTO'); assert.equal(fatigueRisk({ sinceBreakMin: 40, hour: 11 }, EXAMPLE_FATIGUE).level, 'BAJO');
  assert.equal(floodedRoad({ depthCm: 35 }).level, 'ARRASTRA_COCHE'); assert.match(floodedRoad({}).say, /^Da la vuelta/);
  const G = 9.80665, motion = [];
  for (let t = 0; t < 12; t += 0.05) motion.push(t < 5 ? { t, ax: 0, ay: 0, az: G } : Math.abs(t - 5) < 0.06 ? { t, ax: 4 * G, ay: 0, az: G } : { t, ax: G, ay: 0, az: 0 });
  const gps = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].map((t) => ({ t, speed: t < 5 ? 12 : 0 }));
  assert.match(detectRiderFall({ motion, gps }, EXAMPLE_RIDER_FALL).state, /CRASH/);
});

test('V16 + SENDA: la baliza dice dónde; SENDA dice qué pasa; un choque sin V16 pide encenderla', () => {
  const r = v16Fusion([{ id: 'B1', lat: 40.2, lon: -3.3, t: 1000 }, { id: 'B2', lat: 40.5, lon: -3.6, t: 1000 }],
    [{ id: 'r1', lat: 40.2005, lon: -3.3005, t: 1050, kind: 'CRASH', injured: 2, trapped: 1, coordinator: 'Ana' }, { id: 'r2', lat: 41, lon: -3, t: 900, kind: 'CRASH' }], EXAMPLE_V16_FUSION);
  assert.equal(r.incidents[0].kind, 'ACCIDENTE'); assert.equal(r.incidents[0].trapped, 1); assert.deepEqual(r.incidents[0].sources, ['V16', 'SENDA']);
  assert.equal(r.incidents[1].kind, 'VEHICULO_DETENIDO'); assert.equal(r.orphans[0].kind, 'ACCIDENTE_SIN_V16');
});

test('veracidad: sin valores por defecto sin fuente; AASHTO y NWS citados como constantes con nombre', () => {
  assert.throws(() => safeSpeedForVisibility(50, {}), /«mu» debe declararse/);
  assert.throws(() => stoppingDistance(30, { mu: 0.7 }), /«reactS» debe declararse/);
  assert.throws(() => curveSpeed(100, {}), /«e» debe declararse/);
  assert.throws(() => queueTail([], {}), /«slowKmh» debe declararse/);
  assert.throws(() => fatigueRisk({ sinceBreakMin: 10, hour: 3 }), /debe declararse/);
  assert.throws(() => v16Fusion([], [], {}), /«maxM» debe declararse/);
  assert.throws(() => mountainRoad({}), /«lat0» debe declararse/);
  assert.throws(() => detectRiderFall({ motion: [], gps: [] }, {}), /«impactG» debe declararse/);
  assert.equal(EXAMPLE_CURVE.brakeMs2, AASHTO_SSD.decelMs2);
  assert.deepEqual([NWS_FLOOD_CM.loseControl, NWS_FLOOD_CM.carryCar, NWS_FLOOD_CM.carrySuv], [15, 30, 60]);
  for (const ex of [EXAMPLE_MU, EXAMPLE_DRIVER, EXAMPLE_CURVE, EXAMPLE_FATIGUE]) assert.match(ex.basis, /EJEMPLO_DECLARADO/);
});
