import test from 'node:test';
import assert from 'node:assert/strict';
import { speedOfSound, fireHotspots, bearingFromColumn, intersectBearings, corroborate, buildEvent, verifyEvent, eventToCap, powerBudget } from '../src/vigia.mjs';
import { rng } from '../src/incident-ops.mjs';

const RAD = Math.PI / 180;
const az = (from, to) => ((Math.atan2(to.x - from.x, to.y - from.y) / RAD) + 360) % 360;
const FIRE = { x: 400, y: 600 };
const NODES = { N1: { x: 0, y: 0 }, N2: { x: 900, y: 100 }, N3: { x: 300, y: 1200 }, N4: { x: 1000, y: 900 } };

// fotograma 32×24 sintético: ambiente 18 °C con ruido y un foco de 2×2 px en la columna que toca
function frameWithFire(bearingDeg, headingDeg, { fov = 55, peak = 320, seed = 1 } = {}) {
  const R = rng(seed), w = 32, h = 24, f = Array.from({ length: w * h }, () => 18 + R() * 2);
  const u = Math.tan((bearingDeg - headingDeg) * RAD) / Math.tan((fov / 2) * RAD), col = Math.round(u * (w / 2) + w / 2 - 0.5);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = col + dx, y = 12 + dy; if (x >= 0 && x < w) f[y * w + x] = peak - 40 * (dx + dy); }
  return f;
}

test('física: velocidad del sonido según temperatura (331,3·√(1+T/273,15))', () => {
  assert.ok(Math.abs(speedOfSound(0) - 331.3) < 1e-9);
  assert.ok(Math.abs(speedOfSound(20) - 343.2) < 0.1);
  assert.ok(Math.abs(speedOfSound(35) - 351.9) < 0.1);
});

test('térmica: detecta el foco, ignora el ambiente y el rumbo de la columna cuadra con la geometría', () => {
  const brg = az(NODES.N1, FIRE), heading = 30;
  const t = fireHotspots(frameWithFire(brg, heading));
  assert.equal(t.spots.length, 1);
  assert.ok(t.ambientC < 21 && t.spots[0].peakC === 320);
  const got = bearingFromColumn(t.spots[0].col, { headingDeg: heading });
  assert.ok(Math.abs(got - brg) < 1.5, `rumbo ${got.toFixed(2)} frente a ${brg.toFixed(2)}`);
  // un fotograma sin foco: nada
  assert.equal(fireHotspots(Array(768).fill(22)).spots.length, 0);
});

test('rumbos: dos semirrectas se cortan en el fuego; si el punto queda detrás de un sensor no vale', () => {
  const p = intersectBearings([{ ...NODES.N1, bearingDeg: az(NODES.N1, FIRE) }, { ...NODES.N2, bearingDeg: az(NODES.N2, FIRE) }]);
  assert.ok(Math.hypot(p.x - FIRE.x, p.y - FIRE.y) < 1e-6);
  assert.equal(intersectBearings([{ ...NODES.N1, bearingDeg: az(NODES.N1, FIRE) + 180 }, { ...NODES.N2, bearingDeg: az(NODES.N2, FIRE) + 180 }]), null);
});

test('consenso: tres térmicas baratas con ±1° de error sitúan el fuego a menos de 25 m', () => {
  const R = rng(7);
  const obs = ['N1', 'N2', 'N3'].map((n) => ({ nodeId: n, modality: 'THERMAL', kind: 'BEARING', ...NODES[n], bearingDeg: az(NODES[n], FIRE) + (R() * 2 - 1) }));
  const r = corroborate(obs);
  assert.equal(r.level, 'CONFIRMED');
  assert.ok(Math.hypot(r.location.x - FIRE.x, r.location.y - FIRE.y) < 25, JSON.stringify(r.location));
  assert.deepEqual(r.outliers, []);
});

test('un solo sensor nunca da la alarma, por muy caliente que vea', () => {
  const r = corroborate([{ nodeId: 'N1', modality: 'THERMAL', kind: 'BEARING', ...NODES.N1, bearingDeg: 40 }]);
  assert.equal(r.level, 'UNCONFIRMED');
});

test('nodo manipulado o averiado: su rumbo falso se señala como incoherente y no mueve el punto', () => {
  const obs = ['N1', 'N2', 'N3'].map((n) => ({ nodeId: n, modality: 'THERMAL', kind: 'BEARING', ...NODES[n], bearingDeg: az(NODES[n], FIRE) }));
  obs.push({ nodeId: 'N4', modality: 'THERMAL', kind: 'BEARING', ...NODES.N4, bearingDeg: az(NODES.N4, { x: 1500, y: 200 }) });
  const r = corroborate(obs);
  assert.equal(r.level, 'CONFIRMED');
  assert.deepEqual(r.outliers, ['N4']);
  assert.ok(Math.hypot(r.location.x - FIRE.x, r.location.y - FIRE.y) < 1);
});

test('dos modalidades independientes (térmica + acústica) confirman; un reloj falseado queda fuera', () => {
  const T = 35, c = speedOfSound(T), t0 = 100;
  const obs = [
    { nodeId: 'N1', modality: 'THERMAL', kind: 'BEARING', ...NODES.N1, bearingDeg: az(NODES.N1, FIRE) },
    ...['N2', 'N3', 'N4'].map((n) => ({ nodeId: n, modality: 'ACOUSTIC', kind: 'TOA', ...NODES[n], t: t0 + Math.hypot(NODES[n].x - FIRE.x, NODES[n].y - FIRE.y) / c })),
    { nodeId: 'M5', modality: 'ACOUSTIC', kind: 'TOA', x: 600, y: 300, t: t0 + Math.hypot(200, 300) / c + 0.4 }, // 0,4 s de más = 140 m de mentira
  ];
  const r = corroborate(obs, { tempC: T });
  assert.equal(r.level, 'CONFIRMED');
  assert.deepEqual(r.modalities.sort(), ['ACOUSTIC', 'THERMAL']);
  assert.deepEqual(r.outliers, ['M5']);
  assert.ok(Math.hypot(r.location.x - FIRE.x, r.location.y - FIRE.y) < 5);
});

test('la temperatura importa: suponer 343 m/s en un día de 40 °C desplaza el estallido', () => {
  const T = 40, c = speedOfSound(T), t0 = 5, P = { x: 700, y: 650 };
  const obs = Object.entries(NODES).map(([n, q]) => ({ nodeId: n, modality: 'ACOUSTIC', kind: 'TOA', ...q, t: t0 + Math.hypot(q.x - P.x, q.y - P.y) / c }));
  const good = corroborate(obs, { tempC: T, gateM: 5 }), naive = corroborate(obs, { tempC: 20, gateM: 5 });
  const eGood = Math.hypot(good.location.x - P.x, good.location.y - P.y), eNaive = Math.hypot(naive.location.x - P.x, naive.location.y - P.y);
  assert.ok(eGood < 0.5, `corregido ${eGood}`);
  assert.ok(eNaive > eGood, `sin corregir ${eNaive.toFixed(2)} m frente a ${eGood.toFixed(2)} m`);
});

test('confianza aprendida: un nodo con historial de falsas alarmas pesa menos en el desempate', () => {
  const obs = [
    { nodeId: 'A', modality: 'THERMAL', kind: 'BEARING', ...NODES.N1, bearingDeg: az(NODES.N1, FIRE) },
    { nodeId: 'B', modality: 'THERMAL', kind: 'BEARING', ...NODES.N2, bearingDeg: az(NODES.N2, FIRE) },
    { nodeId: 'C', modality: 'THERMAL', kind: 'BEARING', ...NODES.N3, bearingDeg: az(NODES.N3, { x: 900, y: 700 }) },
    { nodeId: 'D', modality: 'THERMAL', kind: 'BEARING', ...NODES.N4, bearingDeg: az(NODES.N4, { x: 900, y: 700 }) },
  ];
  const r = corroborate(obs, { trust: { C: 0.2, D: 0.2 } });
  assert.deepEqual(r.inliers.sort(), ['A', 'B']);
  assert.equal(r.level, 'PROBABLE', 'dos nodos de la misma modalidad: probable, no confirmado');
});

test('suceso firmado: verifica, se rompe si lo alteran, no admite imagen ni audio y sale en CAP 1.2', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const obs = ['N1', 'N2', 'N3'].map((n) => ({ nodeId: n, modality: 'THERMAL', kind: 'BEARING', ...NODES[n], bearingDeg: az(NODES[n], FIRE) }));
  const r = corroborate(obs);
  const ev = await buildEvent({ id: 'ev-1', kind: 'FIRE', at: 1_800_000_000_000, result: r, nodeKeys: keys });
  assert.equal(await verifyEvent(ev, keys.publicKey), true);
  assert.equal(await verifyEvent({ ...ev, x: ev.x + 300 }, keys.publicKey), false);
  await assert.rejects(buildEvent({ id: 'x', kind: 'FIRE', at: 1, result: { ...r, frame: [1, 2] }, nodeKeys: keys }), /privacidad/);
  const cap = eventToCap(ev, { lat: 40.36, lon: -4.40 });
  assert.match(cap, /<msgType>Alert<\/msgType>/);
  assert.match(cap, /<category>Fire<\/category>/);
  assert.match(cap, /<status>Exercise<\/status>/);
});

test('energía: la cuenta del balance solar es aritmética explícita (los consumos son datos de entrada)', () => {
  const b = powerBudget({ loads: [{ name: 'mcu', mA: 40, duty: 0.5 }, { name: 'radio', mA: 120, duty: 0.01 }], volts: 3.7, batteryMah: 3000, solarW: 2, sunHours: 3, chargeEff: 0.7 });
  assert.equal(b.avgMa, 21.2);
  assert.equal(b.useWhDay, +(0.0212 * 3.7 * 24).toFixed(3));
  assert.equal(b.solarWhDay, 4.2);
  assert.equal(b.sustainable, true);
  assert.equal(b.autonomyDaysNoSun, +((3 * 3.7 * 0.8) / (0.0212 * 3.7 * 24)).toFixed(1));
});

test('Monte Carlo (semilla fija): 500 fuegos con un nodo mentiroso y 2000 tríos de rumbos al azar', () => {
  const R = rng(2026), errs = []; let confirmed = 0, caught = 0, fake3 = 0;
  for (let i = 0; i < 500; i++) {
    const F = { x: 200 + R() * 600, y: 200 + R() * 800 };
    const obs = ['N1', 'N2', 'N3'].map((n) => ({ nodeId: n, modality: 'THERMAL', kind: 'BEARING', ...NODES[n], bearingDeg: az(NODES[n], F) + (R() * 2 - 1) }));
    obs.push({ nodeId: 'N4', modality: 'THERMAL', kind: 'BEARING', ...NODES.N4, bearingDeg: R() * 360 });
    const r = corroborate(obs); if (r.level === 'CONFIRMED') confirmed++; if (r.outliers.includes('N4')) caught++;
    errs.push(Math.hypot(r.location.x - F.x, r.location.y - F.y));
  }
  for (let i = 0; i < 2000; i++) if (corroborate(['N1', 'N2', 'N3'].map((n) => ({ nodeId: n, modality: 'THERMAL', kind: 'BEARING', ...NODES[n], bearingDeg: R() * 360 }))).level === 'CONFIRMED') fake3++;
  errs.sort((a, b) => a - b);
  assert.ok(confirmed >= 490, `confirmados ${confirmed}/500`);
  assert.ok(caught >= 470, `mentiroso detectado ${caught}/500`);
  assert.ok(errs[475] < 30, `p95 ${errs[475].toFixed(1)} m`);
  assert.ok(fake3 / 2000 < 0.01, `falso consenso ${fake3}/2000`);
});
