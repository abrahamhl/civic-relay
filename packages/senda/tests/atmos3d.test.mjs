import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/atmos3d.mjs';
import { toUtm, fromUtm } from '../src/utm.mjs';

test('termodinámica: densidad estándar, θ, rocío, Haines y estabilidad', () => {
  assert.ok(Math.abs(A.airDensity(1013.25, 15, 0) - 1.225) < 0.001);
  assert.ok(A.airDensity(920, 36, 7) < 1.05, 'aire caliente de meseta: ~15 % menos denso');
  assert.ok(Math.abs(A.potentialTempK(20, 1000) - 293.15) < 1e-9);
  assert.ok(Math.abs(A.dewPoint(30, 100) - 30) < 0.01 && A.dewPoint(36, 7) < 0);
  assert.equal(A.hainesIndex({ t850: 25, t700: 12, td850: 5 }).value, 6);
  assert.equal(A.hainesIndex({ t850: 10, t700: 6, td850: 8 }).value, 2);
  assert.ok(A.bruntN2(300, 0, 303, 1000) > 0 && A.bruntN2(303, 0, 300, 1000) < 0);
  assert.equal(A.lclHeightM(30, 10), 2500);
});

test('UTM: ida y vuelta submilimétrica y valores de referencia (pyproj)', () => {
  const p = toUtm(40.362, -4.385, 30);
  assert.ok(Math.abs(p.x - 382401.6) < 0.05 && Math.abs(p.y - 4468857.52) < 0.05);
  const q = fromUtm(p.x, p.y, 30); assert.ok(Math.abs(q.lat - 40.362) < 1e-8 && Math.abs(q.lon + 4.385) < 1e-8);
});

test('OBD-II: presión barométrica y temperatura ambiente (SAE J1979)', () => {
  assert.equal(A.obdDecode(0x33, 92).value, 92); assert.equal(A.obdDecode(0x46, 76).value, 36); assert.equal(A.obdDecode(0x0c, 0x1a, 0xf8).value, 1726);
  assert.equal(A.obdDecode(0x99, 1), null);
});

test('anemometría de flota: la deceleración en rueda libre devuelve el viento a lo largo de la vía y varios rumbos el vector', () => {
  const rho = 1.05, m = 1500, cdA = 0.7, crr = 0.011, v = 22;
  for (const w of [-6, 0, 4]) { const a = -(0.5 * rho * cdA * (v - w) * Math.abs(v - w) + m * A.G * crr) / m; assert.ok(Math.abs(A.coastdownWind({ aMs2: a, vMs: v, rho, cdA, crr, massKg: m }).wParMs - w) < 1e-6); }
  const u = 3, vv = -4, obs = [0, 60, 135, 250, 300].map((h) => ({ headingDeg: h, wParMs: u * Math.sin((h * Math.PI) / 180) + vv * Math.cos((h * Math.PI) / 180), sdMs: 1 }));
  const f = A.fleetWind(obs); assert.ok(f.ok && Math.abs(f.u - u) < 1e-9 && Math.abs(f.v - vv) < 1e-9); assert.ok(Math.abs(f.dirFromDeg - 323.13) < 0.01);
  assert.equal(A.fleetWind([{ headingDeg: 90, wParMs: 2 }, { headingDeg: 270, wParMs: -2 }]).ok, false, 'misma recta: indeterminado');
});

test('barómetros: reducción hipsométrica, sesgo por Kalman e interpolación óptima', () => {
  assert.ok(Math.abs(A.reducePressure(1000, 0, 0) - 1000) < 1e-9 && A.reducePressure(900, 1000, 0) > 1000);
  let st = { b: 0, P: 4 }; for (let k = 0; k < 30; k++) st = A.biasKalman(st, 1.3); assert.ok(Math.abs(st.b - 1.3) < 0.05 && st.P < 0.1);
  const r = A.optimalInterpolation([{ x: 0, y: 0 }, { x: 50000, y: 0 }], [{ x: 0, y: 0, val: 2, sd: 0.1 }], () => 0, { L: 3000, sdB: 1 });
  assert.ok(Math.abs(r.val[0] - 2 / 1.01) < 1e-6, 'fórmula de un solo dato: σb²/(σb²+σo²)');
  assert.ok(Math.abs(r.val[1]) < 1e-6 && r.sd[0] < r.sd[1], 'lejos manda el fondo y la incertidumbre es mayor');
});

const flat = (x, y) => 500 + 0 * x * y;
test('viento 3D: en llano un viento uniforme ya es solenoidal y no cambia; una colina lo desvía y la divergencia cae', () => {
  const g = A.makeWindGrid({ nx: 16, ny: 14, nz: 10, dx: 200, dz: 50, heightAt: flat });
  const f0 = A.initialWind(g, () => ({ u: 5, v: 2 })), f = A.massConsistent(g, f0, { iters: 200 });
  assert.ok(f.divAfter < 1e-4); const c = A.cellVelocity(g, f, 8, 7, 5); assert.ok(Math.abs(c.u - 5) < 0.05 && Math.abs(c.v - 2) < 0.05 && Math.abs(c.w) < 0.05);
  const hill = (x, y) => 500 + 300 * Math.exp(-((x - 1600) ** 2 + (y - 1400) ** 2) / (2 * 400 ** 2));
  const gh = A.makeWindGrid({ nx: 16, ny: 14, nz: 14, dx: 200, dz: 50, heightAt: hill }), fh = A.massConsistent(gh, A.initialWind(gh, () => ({ u: 6, v: 0 })), { iters: 400 });
  assert.ok(fh.divAfter < fh.divBefore / 100, `${fh.divBefore} → ${fh.divAfter}`);
  let wUp = 0; for (let k = 0; k < gh.nz; k++) { if (gh.solid[(k * gh.ny + 7) * gh.nx + 6]) continue; wUp = Math.max(wUp, A.cellVelocity(gh, fh, 6, 7, k).w); }
  assert.ok(wUp > 0.3, `ladera de barlovento: sube el aire (${wUp.toFixed(2)} m/s)`);
});

test('pluma: Briggs coherente y la corriente ascendente impuesta genera aspiración hacia el fuego', () => {
  const P = A.briggsPlume({ qW: 5e9, U: 8, N2: 1e-4, hpbl: 1500 });
  assert.ok(P.finalRiseM > 300 && P.finalRiseM < 3000 && P.rise(100) < P.rise(1000));
  assert.ok(Math.abs(A.buoyancyFlux(1e9, { rho: 1.1, tK: 305 }) - (A.G * 1e9) / (Math.PI * A.CP * 1.1 * 305)) < 1e-6);
  const g = A.makeWindGrid({ nx: 20, ny: 20, nz: 16, dx: 150, dz: 60, heightAt: flat }), base = A.initialWind(g, () => ({ u: 0.5, v: 0 }));
  const imp = A.imposePlume(g, base, { x: 1500, y: 1500, qW: 8e9, U: 2, dirToDeg: 90, N2: 1e-4, hpbl: 1200 }); assert.ok(imp.faces > 0);
  const f = A.massConsistent(g, imp.field, { iters: 400, fixedW: imp.fixedW });
  const s = A.sampleWind(g, f, 1500 - 600, 1500, 500 + 40), n = A.sampleWind(g, f, 1500, 1500 + 600, 500 + 40);
  assert.ok(s.u > 0.5 && n.v < 0, `aire hacia el foco: oeste u=${s.u.toFixed(2)}, norte v=${n.v.toFixed(2)}`);
});

test('aviones: estela, rotor y energía de una descarga (orden de magnitud)', () => {
  const w = A.wakeVortex({ ...A.AIRCRAFT['CL-415'], rho: 1.05 }); assert.ok(w.circulation > 50 && w.circulation < 400 && w.descentMs > 0.3 && w.descentMs < 3);
  const r = A.rotorDownwash({ massKg: 5000, rotorRadiusM: 7, rho: 1.1 }); assert.ok(r.induced > 8 && r.induced < 18 && r.farWake === 2 * r.induced);
  const d = A.dropEffect({ litres: 6137, intensityKWm: 7000 }); assert.ok(d.energyGJ > 4 && d.energyGJ < 6 && d.secondsCancelled < 10);
  assert.ok(A.dropEffect({ litres: 6137, intensityKWm: 300 }).secondsCancelled > 100, 'en un frente débil la descarga sí lo detiene un buen rato');
});

test('partículas: humo transportado con el viento y pavesas que caen y se cuentan', () => {
  const g = A.makeWindGrid({ nx: 30, ny: 10, nz: 10, dx: 200, dz: 60, heightAt: flat }), f = A.massConsistent(g, A.initialWind(g, () => ({ u: 6, v: 0 })), { iters: 50 });
  const smoke = A.advectParticles(g, f, [{ x: 500, y: 1000, z: 800 }], { dt: 2, steps: 100, sigmaTurb: 0 });
  assert.ok(smoke.tracks[0].at(-1).x > 1500, 'avanza con el viento');
  const emb = A.advectParticles(g, f, [{ x: 500, y: 1000, z: 700 }, { x: 500, y: 1000, z: 900 }], { dt: 1, steps: 600, sigmaTurb: 0, terminalMs: 4, burnoutS: 120 });
  assert.equal(emb.landed.length, 2); assert.ok(emb.landed[1].distM > emb.landed[0].distM, 'más alto, más lejos');
  assert.ok(Math.abs(emb.landed[0].distM - 6 * 50) < 80, 'z 200 m sobre el suelo / 4 m/s = 50 s × 6 m/s');
});
