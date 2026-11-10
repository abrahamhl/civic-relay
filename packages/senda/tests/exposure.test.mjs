import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  toLaea, fromLaea, residentPresenceFactor, residentsInCircle, densityFromOccupancy, roadSegmentExposure,
  parseDigitrafficTms, parseMadridPm, chainCoverageProbability, chainReachProfile, expectedHopProgressM,
  roadWarningPlan, prioritizeByExposure,
} from '../src/exposure.mjs';
import { fromUtm } from '../src/utm.mjs';
import { mulberry32 } from '../src/opportunistic-routing.mjs';

const fixture = (f) => new URL(`./fixtures/${f}`, import.meta.url);
const madridCells = () => readFileSync(fixture('madrid_pop_1km_2021.csv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => { const [x_llc, y_llc, pop] = l.split(',').map(Number); return { x_llc, y_llc, pop }; });

test('EPSG:3035 reproduce el ejemplo oficial de EPSG (GN 7-2) y es reversible', () => {
  const p = toLaea(50, 5);
  assert.ok(Math.abs(p.x - 3962799.45) < 0.01 && Math.abs(p.y - 2999718.85) < 0.01, JSON.stringify(p));
  const back = fromLaea(3962799.45, 2999718.85);
  assert.ok(Math.abs(back.lat - 50) < 1e-6 && Math.abs(back.lon - 5) < 1e-6);
  for (const [lat, lon] of [[40.4168, -3.7038], [28.1, -15.4], [43.36, -8.41], [39.47, -0.38]]) {
    const q = fromLaea(...Object.values(toLaea(lat, lon)));
    assert.ok(Math.abs(q.lat - lat) < 1e-7 && Math.abs(q.lon - lon) < 1e-7);
  }
});

test('Rejilla real GISCO 2021: la Comunidad de Madrid suma ≈ 6,7 millones y Sol tiene decenas de miles en 1 km', () => {
  const cells = madridCells();
  const total = cells.reduce((a, c) => a + c.pop, 0);
  assert.ok(total > 6.6e6 && total < 6.85e6, `ES300 = ${total}`);
  const sol = residentsInCircle(cells, { lat: 40.4168, lon: -3.7038, radiusM: 1000 });
  assert.ok(sol.residents > 30000 && sol.residents < 150000, `Sol 1 km = ${sol.residents}`);
  // Un círculo que contiene una celda entera recoge toda su población.
  const one = [{ x_llc: 3000000, y_llc: 2000000, pop: 1000 }];
  const centre = fromLaea(3000500, 2000500);
  assert.ok(Math.abs(residentsInCircle(one, { ...centre, radiusM: 800 }).residents - 1000) < 1e-6);
  // Un círculo pequeño en el centro recoge ≈ su fracción de área (πr²/1 km²).
  const small = residentsInCircle(one, { ...centre, radiusM: 300 }, { samples: 40 }).residents;
  assert.ok(Math.abs(small - 1000 * Math.PI * 0.09) < 15, `${small}`);
});

test('Presencia de residentes: hipótesis declarada por franja horaria', () => {
  assert.equal(residentPresenceFactor(3), 0.95);
  assert.ok(residentPresenceFactor(12) < residentPresenceFactor(21));
  assert.equal(residentPresenceFactor(12, { weekend: true }), 0.75);
  assert.throws(() => residentPresenceFactor(24), RangeError);
});

test('Tráfico: relación fundamental q = k·v y densidad desde ocupación', () => {
  const e = roadSegmentExposure({ flowVehH: 1800, speedKmh: 90, lengthKm: 2 });
  assert.equal(e.densityVehKm, 20);
  assert.equal(e.vehicles, 40);
  assert.ok(Math.abs(e.persons - 56) < 1e-9);
  assert.ok(e.persons90[0] < e.persons && e.persons < e.persons90[1]);
  assert.ok(Math.abs(densityFromOccupancy(13) - 20) < 1e-9, '13 % de ocupación con 6,5 m ≈ 20 veh/km/carril');
});

test('Datos reales: Digitraffic TMS y detectores de Informo Madrid se leen con unidades y posición', () => {
  const tms = parseDigitrafficTms(JSON.parse(readFileSync(fixture('digitraffic-tms-2026-11-10.json'))));
  assert.ok(tms.length >= 40, `${tms.length} estación-sentido`);
  for (const r of tms) assert.ok(r.flowVehH >= 0 && r.speedKmh > 5 && [1, 2].includes(r.direction));
  const pm = parseMadridPm(readFileSync(fixture('madrid-pm-2026-11-10-sample.xml'), 'utf8'), { fromUtm });
  assert.ok(pm.length > 100);
  for (const d of pm) assert.ok(d.lat > 40.2 && d.lat < 40.6 && d.lon > -3.95 && d.lon < -3.5, `${d.id} ${d.lat},${d.lon}`);
  assert.throws(() => parseDigitrafficTms({}), TypeError);
});

/** Monte Carlo de referencia: equipados Poisson(λ) en (0, D], cadena con alcance r desde el origen. */
function mcChain(lambda, r, D, N, seed = 7) {
  const rnd = mulberry32(seed);
  let all = 0, reached = 0, total = 0, progress = 0, hopsWithNeighbour = 0;
  for (let t = 0; t < N; t++) {
    const pts = [];
    for (let x = 0; ;) { x += -Math.log(1 - rnd()) / lambda; if (x > D) break; pts.push(x); }
    let last = 0, cnt = 0, ok = true;
    for (const p of pts) { if (p - last > r) { ok = false; break; } cnt++; last = p; }
    if (ok) all++;
    reached += cnt; total += pts.length;
    const within = pts.filter((p) => p <= r);
    if (within.length) { progress += Math.max(...within); hopsWithNeighbour++; }
  }
  return { pAll: all / N, frac: reached / total, progress: progress / hopsWithNeighbour };
}

test('Cadena de retransmisión: probabilidad exacta, fracción alcanzada y avance por salto = Monte Carlo', () => {
  for (const [lambda, r, D] of [[0.0216, 60, 388], [0.0036, 60, 388], [0.05, 60, 1000], [0.01, 100, 500]]) {
    const mc = mcChain(lambda, r, D, 20000);
    const pAll = chainCoverageProbability({ lambdaPerM: lambda, rangeM: r, distanceM: D });
    const frac = chainReachProfile({ lambdaPerM: lambda, rangeM: r, distanceM: D }).reachedFraction;
    const prog = expectedHopProgressM(lambda, r);
    assert.ok(Math.abs(pAll - mc.pAll) < 0.012, `pAll ${pAll} vs ${mc.pAll}`);
    assert.ok(Math.abs(frac - mc.frac) < 0.012, `frac ${frac} vs ${mc.frac}`);
    assert.ok(Math.abs(prog - mc.progress) < 1.2, `progreso ${prog} vs ${mc.progress}`); // ≈ 4 σ del MC con pocas muestras con vecino
  }
  assert.equal(chainCoverageProbability({ lambdaPerM: 0.01, rangeM: 60, distanceM: 50 }), 1, 'D ≤ r: alcance directo');
  assert.equal(chainReachProfile({ lambdaPerM: 0.01, rangeM: 60, distanceM: 50 }).reachedFraction, 1);
});

test('La fracción alcanzada CRECE con la penetración (la métrica «llegar a todos» no lo hace)', () => {
  const base = { flowVehH: 3600, speedKmh: 100 };
  const f = [0.1, 0.3, 0.6].map((p) => roadWarningPlan({ ...base, penetration: p }).expectedEquippedReachedFraction);
  assert.ok(f[0] < f[1] && f[1] < f[2], f.join(' < '));
});

test('Plan adaptativo: más tráfico y velocidad ⇒ zona de peligro, saltos y vehículos en riesgo mayores; la política fija se queda corta', () => {
  const light = roadWarningPlan({ flowVehH: 300, speedKmh: 90 });
  const heavy = roadWarningPlan({ flowVehH: 3600, speedKmh: 100 });
  assert.ok(heavy.dangerZoneM > light.dangerZoneM);
  assert.ok(heavy.vehiclesAtRisk > 10 * light.vehiclesAtRisk);
  assert.ok(heavy.recommended.maxHops > 3, 'con tráfico denso hacen falta más de los 3 saltos fijos');
  assert.ok(heavy.fixedPolicy.coverageOfDangerZone < 0.5, `la política fija cubre ${heavy.fixedPolicy.coverageOfDangerZone}`);
  assert.ok(heavy.multiHopLatencyS < heavy.brakeLightsToLastS, 'la cadena de radio es más rápida que la de luces de freno');
  // Onda de choque LWR contra una cola parada: w = q / (k_jam − k).
  const kJam = 133 * 2, k = 3600 / 100;
  assert.ok(Math.abs(heavy.shockwaveKmh - 3600 / (kJam - k)) < 1e-9);
  assert.throws(() => roadWarningPlan({ flowVehH: 0, speedKmh: 90 }), RangeError);
});

test('Priorización por personas afectadas esperadas, con intervalo', () => {
  const r = prioritizeByExposure([
    { id: 'pueblo', pHazard: 0.6, exposure: { mean: 400, lo: 300, hi: 500 } },
    { id: 'autovía', pHazard: 0.2, exposure: { mean: 3000, lo: 2000, hi: 4000 } },
    { id: 'polígono', pHazard: 0.9, exposure: { mean: 50 } },
  ]);
  assert.deepEqual(r.map((z) => z.id), ['autovía', 'pueblo', 'polígono']);
  assert.deepEqual(r[0].expectedAffected90, [400, 800]);
  assert.throws(() => prioritizeByExposure([{ id: 'x', pHazard: 2, exposure: { mean: 1 } }]), RangeError);
});
