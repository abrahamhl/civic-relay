import test from 'node:test';
import assert from 'node:assert/strict';
import * as TF from '../src/traffic-fusion.mjs';

test('diagrama fundamental triangular: capacidad en kc, velocidad libre y rama congestionada invertible', () => {
  const fd = TF.triangularFD({ vfKmh: 60, qmax: 1800, kj: 133 });
  assert.equal(fd.kc, 30); assert.equal(fd.flow(30), 1800); assert.equal(fd.speed(10), 60); assert.equal(fd.flow(133), 0);
  const k = 80, v = fd.speed(k); assert.ok(Math.abs(fd.densityFromSpeed(v) - k) < 1e-9);
});

test('humo: la distancia de parada limita la velocidad y la capacidad cae con ella', () => {
  const v50 = TF.smokeSpeedKmh(50), v200 = TF.smokeSpeedKmh(200); assert.ok(v50 < v200 && v50 > 30 && v50 < 55);
  const v = v50 / 3.6; assert.ok(Math.abs(v * 2.5 + (v * v) / (2 * 3.4) - 50) < 1e-6);
  assert.ok(TF.headwayCapacity(20) < TF.headwayCapacity(50) && Math.abs(TF.headwayCapacity(50) - 1765) < 2);
});

test('CTM: conserva vehículos, la cola remonta aguas arriba desde un cuello de botella y el despeje se retrasa', () => {
  const R = TF.makeRoute(Array.from({ length: 6 }, () => ({ lenKm: 1, lanes: 1, vfKmh: 60 })));
  let n = [50, 50, 50, 0, 0, 0], out = 0; const total = 150;
  for (let s = 0; s < 200; s++) { const r = TF.ctmStep(R, n, 30, { exitCapVehH: 600 }); n = r.n; out += r.out; assert.ok(Math.abs(n.reduce((a, b) => a + b, 0) + out - total) < 1e-6); }
  const fast = TF.simulateEvacuation(R, { demand: [400, 0, 0, 0, 0, 0], tauMin: 10, durMin: 300 }), slow = TF.simulateEvacuation(R, { demand: [400, 0, 0, 0, 0, 0], tauMin: 10, durMin: 300, exitCap: () => 300 });
  assert.ok(slow.clearMin > fast.clearMin * 2);
  const mid = slow.series.find((x) => x.tMin >= 22); assert.ok(mid.speed[5] < 30 && mid.speed[3] < 60, 'la congestión se propaga hacia atrás');
});

test('fuego y tráfico: avisar antes reduce la exposición; el cierre evita meter coches en tramos que arderán', () => {
  const R = TF.makeRoute(Array.from({ length: 5 }, () => ({ lenKm: 1, lanes: 1, vfKmh: 50 }))), fire = [60, 70, 80, Infinity, Infinity], demand = [600, 300, 0, 0, 0];
  const late = TF.simulateEvacuation(R, { demand, warnMin: 30, tauMin: 20, durMin: 300, fireArrivalMin: fire }), early = TF.simulateEvacuation(R, { demand, warnMin: -60, tauMin: 20, durMin: 300, fireArrivalMin: fire });
  assert.ok(early.exposedVehMin < late.exposedVehMin);
  const w = TF.latestSafeWarning(R, { demand, tauMin: 20, durMin: 400, fireArrivalMin: fire }); assert.ok(w.ok && w.warnMin < 60);
  const cl = TF.closureSchedule(R, fire, { marginMin: 10 }); assert.ok(cl[0] < 60 - 10 && cl[3] === null);
  assert.ok(Math.abs(TF.triggerBufferKm({ rosKmh: 6, clearMin: 45, marginMin: 15, spottingKm: 1 }) - 7) < 1e-12);
});

test('EnKF: estima la capacidad oculta de la salida a partir de cámaras y sondas (gemelo simulado)', () => {
  const R = TF.makeRoute(Array.from({ length: 6 }, () => ({ lenKm: 1.5, lanes: 1, vfKmh: 50 }))), N = 6, F = TF.makeEnkf(R, { members: 30, bottlenecks: [N], seed: 5 });
  let n = new Array(N).fill(0), q = new Array(N).fill(0), prev = 0; const demand = [800, 400, 0, 0, 0, 0], exitTrue = 450;
  for (let s = 0; s <= 160; s++) {
    const t = s * 0.5, dep = TF.rayleighDepart(t, 20), inflow = demand.map((d) => d * (dep - prev)); prev = dep;
    const st = TF.ctmStep(R, n, 30, { exitCapVehH: exitTrue, inflow, queue: q }); n = st.n; q = st.queue; F.forecast(30, { inflow, exitCapVehH: 1800 });
    if (s % 4 === 0) { const k = (c) => n[c] / 1.5; F.analyze([{ tipo: 'sonda-velocidad', cell: 5, valor: R.cells[5].fd.speed(k(5)), sd: 3 }, { tipo: 'camara-flujo', cell: 5, valor: Math.min(R.cells[5].fd.vfKmh * k(5), 1800, exitTrue) / 60, sd: 0.8 }, { tipo: 'camara-densidad', cell: 3, valor: k(3), sd: 2 }]); }
  }
  const m = F.mean(); assert.ok(Math.abs(m.capFactor[0] - 0.25) < 0.08, `factor ${m.capFactor[0]}`);
  const nz = TF.cameraNoiseFromCounts({ meanInFrame: 2, crossings: 4, durationS: 10 }); assert.ok(nz.ratePerMin === 24 && nz.sdInFrame >= 1.41);
});
