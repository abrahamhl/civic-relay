import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/arr-sim.mjs';
import { forecastParticles, pointGeometry, arrivalForecast, arrivalHours, toHazardEnsemble, historicalRate, INVALID_WHEN } from '../src/arr-forecast.mjs';
import { normalizeEnsemble } from '../src/arr-core.mjs';

const disc = (r, cx = 50, cy = 50) => [Array.from({ length: 49 }, (_, i) => [cx + r * Math.cos((i / 48) * 2 * Math.PI), cy + r * Math.sin((i / 48) * 2 * Math.PI)])];
// a fire growing 1 km/h, strongly to the EAST: discs whose centre drifts east
const HOUR = 3600000, per = [0, 1, 2, 3].map((k) => ({ tMs: k * 6 * HOUR, rings: disc(4 + 4 * k, 50 + 3 * k) }));
const area = [100, 100], east = [[88, 50]], west = [[30, 50]];

test('forecast is causal, weights are normalised and persistence never predicts spread', () => {
  const later = per.map((p, i) => (i > 2 ? { ...p, rings: disc(45) } : p));
  for (const mode of ['prior', 'assimilated']) {
    const a = forecastParticles(mulberry32(1), { perimetersKm: per, k0: 2, mode, area });
    assert.deepEqual(a, forecastParticles(mulberry32(1), { perimetersKm: later, k0: 2, mode, area }));
    assert.ok(Math.abs(a.particles.reduce((s, p) => s + p.weight, 0) - 1) < 1e-12 && a.particles.length === 64);
    assert.ok(a.particles.every((p) => p.v > 0 && p.e >= 0 && p.e <= 0.9));
  }
  const still = forecastParticles(mulberry32(1), { perimetersKm: per, k0: 2, mode: 'persistence', area });
  assert.equal(arrivalForecast(still, pointGeometry(per, 2, east), 24)[0].probability, 0);
  assert.equal(forecastParticles(mulberry32(1), { perimetersKm: per, k0: 0, mode: 'assimilated', area }).mode, 'prior'); // nothing to assimilate yet
  assert.ok(Math.abs(historicalRate(per, 2) - 4 / 6) < 0.01 && INVALID_WHEN.length >= 3);
});

test('assimilation learns the observed direction of spread; probabilities grow with the horizon', () => {
  const prior = forecastParticles(mulberry32(3), { perimetersKm: per, k0: 3, mode: 'prior', area });
  const post = forecastParticles(mulberry32(3), { perimetersKm: per, k0: 3, mode: 'assimilated', area, effectiveProbes: 200 });
  const weak = forecastParticles(mulberry32(3), { perimetersKm: per, k0: 3, mode: 'assimilated', area }); // pre-registered tempering
  const pE = (f, h) => arrivalForecast(f, pointGeometry(per, 3, east), h)[0].probability, pW = (f, h) => arrivalForecast(f, pointGeometry(per, 3, west), h)[0].probability;
  assert.ok(post.effectiveSampleSize < 64 * 6);
  // documented defect: with the pre-registered tempering the filter barely moves (see FORECAST_RESULTS.md)
  assert.ok(weak.effectiveSampleSize > 0.8 * 64 * 6);
  assert.ok(pE(post, 24) - pW(post, 24) > pE(prior, 24) - pW(prior, 24) + 0.1); // posterior favours the east
  assert.ok(pE(post, 6) <= pE(post, 24) && pE(post, 24) <= pE(post, 96));
  const inside = arrivalForecast(post, pointGeometry(per, 3, [[59, 50]]), 24)[0];
  assert.ok(inside.alreadyBurnt && inside.probability === 1 && inside.arrivalHoursP50 === 0);
});

test('bridge to the router yields a valid hazard ensemble', () => {
  const f = forecastParticles(mulberry32(5), { perimetersKm: per, k0: 2, area }), nodes = [{ id: 'a', pos: east[0] }, { id: 'b', pos: west[0] }];
  const geo = pointGeometry(per, 2, nodes.map((n) => n.pos)), ens = normalizeEnsemble(toHazardEnsemble(f, nodes, geo));
  assert.equal(ens.length, 64);
  assert.ok(ens.every((m, i) => m.nodeDeathMs.a === Math.round(arrivalHours(geo[0], f.particles[i]) * HOUR)));
});
