/**
 * SENDA ARR — fire-front arrival forecast with data assimilation (H2). PREDICTION, model only.
 *
 * Spread model (deliberately simple, no wind/fuel/slope): from the latest OBSERVED perimeter the front
 * advances at head rate v [km/h] towards heading φ with elongation e:
 *     speed(θ) = v · (1 + e·cos(θ − φ)) / (1 + e),     arrival(x) = distance(x, perimeter) / speed(θ_x)
 * Prior: v ~ LogNormal(median from past equivalent-radius growth, σ), φ ~ U(0, 2π), e ~ U(0, 0.9).
 *
 * Assimilation (one sequential-importance-resampling step, Gordon et al. 1993): particles drawn at the
 * PREVIOUS perimeter are weighted by how well they reproduce the CURRENT observed perimeter on a probe grid,
 * resampled, jittered and propagated from the current perimeter. Only data ≤ planning time is used.
 *
 * Every output must be published with: horizon, uncertainty (member spread), data reference and the
 * invalidity conditions in INVALID_WHEN.
 */
import { insideRings, distanceToRings, gaussian } from './arr-sim.mjs';

const HOUR = 3600000;
export const INVALID_WHEN = Object.freeze([
  'spotting ahead of the front (embers) — not modelled',
  'wind shift after the last observed perimeter — not modelled',
  'suppression lines, roads, water or burnt fuel stopping the front — not modelled',
  'perimeter older than the forecast horizon or mapped with large error',
  'points inside unburnt islands of the perimeter',
]);
/** Fixed a priori (not tuned on evaluation fires). */
export const ASSIMILATION = Object.freeze({ particlesPerMember: 6, probeGrid: 24, probeError: 0.2, effectiveProbes: 12, jitterLogV: 0.25, jitterPhi: 0.3, jitterE: 0.1 });

const ringsArea = (rings) => rings.reduce((s, r) => {
  let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s + Math.abs(a) / 2;
}, 0);
const centroid = (rings) => { let x = 0, y = 0, n = 0; for (const r of rings) for (const p of r) { x += p[0]; y += p[1]; n++; } return [x / n, y / n]; };

/** Median head rate from equivalent-radius growth over perimeters ≤ k (causal). */
export function historicalRate(perimetersKm, k, fallback = 0.3) {
  const rates = [];
  for (let i = 1; i <= k; i++) {
    const dt = (perimetersKm[i].tMs - perimetersKm[i - 1].tMs) / HOUR;
    const dr = Math.sqrt(ringsArea(perimetersKm[i].rings) / Math.PI) - Math.sqrt(ringsArea(perimetersKm[i - 1].rings) / Math.PI);
    if (dt > 0.25 && dr > 0) rates.push(dr / dt);
  }
  const recent = rates.slice(-3);
  return recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : fallback;
}

/** Geometry of points relative to perimeter k: burnt flag (cumulative union ≤ k), distance, bearing. */
export function pointGeometry(perimetersKm, k, points) {
  const union = perimetersKm.slice(0, k + 1).flatMap((p) => p.rings), now = perimetersKm[k].rings, [cx, cy] = centroid(now);
  return points.map((p) => ({ burnt: insideRings(union, p), d: distanceToRings(now, p), theta: Math.atan2(p[1] - cy, p[0] - cx) }));
}
/** Hours until the front reaches a point for one particle (0 if already burnt). */
export const arrivalHours = (g, { v, phi, e }) => (g.burnt ? 0 : g.d / Math.max((v * (1 + e * Math.cos(g.theta - phi))) / (1 + e), 1e-9));

const drawPrior = (rng, median, sigma) => ({ v: median * Math.exp(sigma * gaussian(rng)), phi: 2 * Math.PI * rng(), e: 0.9 * rng() });

/**
 * Forecast particles at planning index k0. mode: 'prior' | 'assimilated' | 'persistence'.
 * Returns { particles: [{v, phi, e, weight}], effectiveSampleSize, mode }.
 */
export function forecastParticles(rng, { perimetersKm, k0, members = 64, sigma = 1.0, mode = 'assimilated', area, effectiveProbes = ASSIMILATION.effectiveProbes }) {
  if (mode === 'persistence') return { mode, particles: [{ v: 0, phi: 0, e: 0, weight: 1 }], effectiveSampleSize: 1 };
  if (mode === 'prior' || k0 === 0) {
    const median = historicalRate(perimetersKm, k0);
    return { mode: 'prior', particles: Array.from({ length: members }, () => ({ ...drawPrior(rng, median, sigma), weight: 1 / members })), effectiveSampleSize: members };
  }
  const A = ASSIMILATION, n = members * A.particlesPerMember, prevMedian = historicalRate(perimetersKm, k0 - 1);
  const probes = [];
  for (let i = 0; i < A.probeGrid; i++) for (let j = 0; j < A.probeGrid; j++) probes.push([((i + 0.5) / A.probeGrid) * area[0], ((j + 0.5) / A.probeGrid) * area[1]]);
  const before = pointGeometry(perimetersKm, k0 - 1, probes), after = pointGeometry(perimetersKm, k0, probes);
  const open = before.map((g, i) => i).filter((i) => !before[i].burnt); // only where the outcome was still unknown
  const dtH = (perimetersKm[k0].tMs - perimetersKm[k0 - 1].tMs) / HOUR;
  const beta = Math.min(1, effectiveProbes / Math.max(1, open.length)); // tempering: probes are spatially correlated
  const drawn = Array.from({ length: n }, () => drawPrior(rng, prevMedian, sigma));
  const logw = drawn.map((p) => {
    let ll = 0;
    for (const i of open) ll += Math.log((arrivalHours(before[i], p) <= dtH) === after[i].burnt ? 1 - A.probeError : A.probeError);
    return beta * ll;
  });
  const top = Math.max(...logw), w = logw.map((l) => Math.exp(l - top)), total = w.reduce((s, x) => s + x, 0);
  const ess = total * total / w.reduce((s, x) => s + x * x, 0);
  const particles = []; // systematic resampling, then jitter (regularisation against collapse)
  let cum = w[0] / total, idx = 0;
  const u0 = rng() / members;
  for (let m = 0; m < members; m++) {
    const u = u0 + m / members;
    while (u > cum && idx < n - 1) cum += w[++idx] / total;
    const p = drawn[idx];
    particles.push({
      v: p.v * Math.exp(A.jitterLogV * gaussian(rng)), phi: p.phi + A.jitterPhi * gaussian(rng),
      e: Math.min(0.9, Math.max(0, p.e + A.jitterE * gaussian(rng))), weight: 1 / members,
    });
  }
  return { mode: 'assimilated', particles, effectiveSampleSize: ess };
}

/** P(front reaches each point within horizon) and arrival-time quantiles — the publishable prediction. */
export function arrivalForecast(forecast, geometry, horizonH) {
  return geometry.map((g) => {
    const hours = forecast.particles.map((p) => arrivalHours(g, p));
    let pWithin = 0; forecast.particles.forEach((p, i) => { if (hours[i] <= horizonH) pWithin += p.weight; });
    const sorted = [...hours].sort((a, b) => a - b), q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(x * sorted.length))];
    return { probability: pWithin, arrivalHoursP10: q(0.1), arrivalHoursP50: q(0.5), arrivalHoursP90: q(0.9), alreadyBurnt: g.burnt };
  });
}

/** Bridge to the router: ensemble members with node loss times, for `planAdaptiveResilience`. */
export function toHazardEnsemble(forecast, nodes, geometry, t0Ms = 0) {
  return forecast.particles.map((p) => ({
    weight: p.weight,
    nodeDeathMs: Object.fromEntries(nodes.map((n, i) => [n.id, Math.round(t0Ms + arrivalHours(geometry[i], p) * HOUR)]).filter(([, t]) => Number.isFinite(t))),
  }));
}
