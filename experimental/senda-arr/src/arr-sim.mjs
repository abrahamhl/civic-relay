/**
 * SENDA ARR — seeded scenario generators, truth simulator and baselines. SIMULATION ONLY.
 *
 * Data classes used below, never to be mixed up in outputs:
 *   OBSERVED   — fire perimeters from USGS GeoMAC snapshots (data/geomac-2018-*.json);
 *   SIMULATED  — node positions, mobility, contact windows, bearer parameters, fading outcomes;
 *   PREDICTED  — hazard ensembles the planner sees (forecast members), built only from data ≤ planning time.
 * Bearer ranges/rates/energies are HYPOTHETICAL planning parameters, not measurements.
 */
import { buildProblem, earliestArrival, generateCandidates, hopAlive, hopTiming, normalizeEnsemble, planAdaptiveResilience, ensembleReliability } from './arr-core.mjs';

/* ------------------------------------------------------------------ deterministic randomness */

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gaussian = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 7.5e-8). */
export function normalCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/* ------------------------------------------------------------------ geometry (km, local plane) */

export function projector(lon0, lat0) {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
  return ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky];
}
/** Even–odd rule across all rings (handles holes and multipart polygons). */
export function insideRings(rings, [x, y]) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function distanceToRings(rings, [x, y]) {
  let best = Infinity;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i], dx = x2 - x1, dy = y2 - y1;
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
  }
  return best;
}
const ringsArea = (rings) => rings.reduce((s, r) => {
  let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s + Math.abs(a) / 2;
}, 0);

/* ------------------------------------------------------------------ topology (SIMULATED) */

/** HYPOTHETICAL long-range low-rate bearer profile (LoRa-class). Not measured; replace with field data. */
export const BEARER_PROFILES = Object.freeze({
  LORA: { rateBytesPerSec: 30, handshakeMs: 1500, energyMj: 260, p: 0.95 }, // p: success within a multi-minute window with link-layer retries (hypothesis)
});
const HOUR = 3600000;

/**
 * Nodes (static relays + mobile carriers on straight shuttle legs) and intermittent contact windows.
 * `area` = [w, h] km. Static pairs in LoRa range wake on a duty-cycled schedule; mobile nodes create
 * windows while within range. Every link is an authorised ACTIVE_RADIO contact between consenting nodes.
 */
export function buildTopology({ rng, area, nStatic = 26, nMobile = 6, horizonMs = 12 * HOUR, payloadBytes = 200, meanDegree = 7, linkP = BEARER_PROFILES.LORA.p, positions = null, windowsPerPair = 3 }) {
  const [w, h] = area;
  // Range is set from a target mean degree, so density (not absolute km) is the controlled variable.
  const loraRangeKm = Math.sqrt((meanDegree * w * h) / (Math.PI * nStatic));
  const node = (id, role, pos, extra = {}) => ({ id, role, consent: true, powered: true, radioEnabled: true, pos, ...extra });
  const nodes = [];
  const statics = positions ?? Array.from({ length: nStatic }, () => [rng() * w, rng() * h]);
  statics.forEach((p, i) => nodes.push(node(`N${String(i).padStart(2, '0')}`, 'RELAY', p)));
  for (let i = 0; i < nMobile; i++) {
    const a = [rng() * w, rng() * h], b = [rng() * w, rng() * h];
    nodes.push(node(`M${i}`, 'RELAY', a, { mobile: { a, b, periodMs: (1.5 + 2 * rng()) * HOUR, phase: rng() } }));
  }
  const positionAt = (n, t) => {
    if (!n.mobile) return n.pos;
    const u = ((t / n.mobile.periodMs + n.mobile.phase) % 1 + 1) % 1, s = u < 0.5 ? 2 * u : 2 - 2 * u; // there and back
    return [n.mobile.a[0] + s * (n.mobile.b[0] - n.mobile.a[0]), n.mobile.a[1] + s * (n.mobile.b[1] - n.mobile.a[1])];
  };
  const contacts = [];
  const add = (a, b, bearer, startMs, endMs) => {
    const prof = BEARER_PROFILES[bearer];
    for (const [from, to] of [[a, b], [b, a]]) contacts.push({
      id: `c${contacts.length}`, from: from.id, to: to.id, kind: 'ACTIVE_RADIO', bearer, authorized: true, enabled: true, dutyCycleAllowed: true,
      startMs: Math.round(startMs), endMs: Math.round(endMs), rateBytesPerSec: prof.rateBytesPerSec, handshakeMs: prof.handshakeMs,
      energyMj: prof.energyMj, probabilityLowerBound: linkP,
    });
  };
  const stat = nodes.filter((n) => !n.mobile), mob = nodes.filter((n) => n.mobile);
  for (let i = 0; i < stat.length; i++) for (let j = i + 1; j < stat.length; j++) {
    const d = Math.hypot(stat[i].pos[0] - stat[j].pos[0], stat[i].pos[1] - stat[j].pos[1]);
    if (d > loraRangeKm) continue;
    for (let k = 0; k < windowsPerPair; k++) { // duty-cycled rendezvous windows, 6–12 min each
      const start = rng() * (horizonMs - 15 * 60000);
      add(stat[i], stat[j], 'LORA', start, start + (6 + 6 * rng()) * 60000);
    }
  }
  const step = 5 * 60000;
  for (const m of mob) for (const o of nodes) {
    if (o === m || (o.mobile && o.id < m.id)) continue;
    let open = null;
    for (let t = 0; t <= horizonMs; t += step) {
      const p = positionAt(m, t), q = positionAt(o, t), near = Math.hypot(p[0] - q[0], p[1] - q[1]) <= loraRangeKm * 0.6;
      if (near && open === null) open = t;
      if ((!near || t + step > horizonMs) && open !== null) { if (t - open >= step) add(m, o, 'LORA', open, t); open = null; }
    }
  }
  return { nodes, contacts, positionAt, payloadBytes, horizonMs };
}

/** Pick a far-apart source/destination pair among static nodes accepted by `allowed`. */
function pickEndpoints(nodes, allowed, rng) {
  const pool = nodes.filter((n) => !n.mobile && allowed(n));
  let best = null;
  for (let tries = 0; tries < 40 && pool.length > 1; tries++) {
    const a = pool[Math.floor(rng() * pool.length)], b = pool[Math.floor(rng() * pool.length)];
    const d = a === b ? -1 : Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
    if (!best || d > best.d) best = { a, b, d };
  }
  if (!best || best.d <= 0) return null;
  best.a.role = 'SENDER'; best.b.role = 'RECEIVER';
  return { source: best.a.id, destination: best.b.id };
}

/* ------------------------------------------------------------------ scenario A: regional common shocks (all SIMULATED) */

/**
 * One-factor Gaussian copula per region: node i fails during the horizon iff Φ(√ρ·Z_region + √(1−ρ)·ε_i) < q.
 * The marginal failure probability is q for every ρ, so ρ isolates the effect of CORRELATION.
 * Failure times share the regional factor the same way. Source and destination are exempt.
 */
export function sampleRegionalHazard(rng, { nodes, regionOf, rho, q, startMs, horizonMs, exempt }) {
  const zFail = new Map(), zTime = new Map(), nodeDeathMs = {};
  const a = Math.sqrt(rho), b = Math.sqrt(1 - rho);
  for (const n of nodes) {
    const r = regionOf(n);
    if (!zFail.has(r)) { zFail.set(r, gaussian(rng)); zTime.set(r, gaussian(rng)); }
    const fail = normalCdf(a * zFail.get(r) + b * gaussian(rng)) < q;
    const when = startMs + normalCdf(a * zTime.get(r) + b * gaussian(rng)) * horizonMs;
    if (fail && !exempt.has(n.id)) nodeDeathMs[n.id] = Math.round(when);
  }
  return { nodeDeathMs };
}

export function makeRegionalInstance({ seed, rho, q = 0.35, forecast = {}, members = 64, grid = 3, areaKm = 18, ...topology }) {
  const rng = mulberry32(seed);
  const topo = buildTopology({ rng, area: [areaKm, areaKm], ...topology });
  const ends = pickEndpoints(topo.nodes, () => true, rng);
  if (!ends) return null;
  const cell = areaKm / grid;
  const regionOf = (n) => `${Math.min(grid - 1, Math.floor(n.pos[0] / cell))}:${Math.min(grid - 1, Math.floor(n.pos[1] / cell))}`;
  const base = { nodes: topo.nodes, regionOf, startMs: 0, horizonMs: topo.horizonMs, exempt: new Set([ends.source, ends.destination]) };
  const fRng = mulberry32(seed ^ 0x9e3779b9);
  const ensemble = Array.from({ length: members }, () => sampleRegionalHazard(fRng, { ...base, rho: forecast.rho ?? rho, q: forecast.q ?? q }));
  return {
    kind: 'REGIONAL_SHOCK', dataClass: { hazardTruth: 'SIMULATED', topology: 'SIMULATED', forecast: 'PREDICTED' },
    nodes: topo.nodes, contacts: topo.contacts, ...ends, startMs: 0, deadlineMs: topo.horizonMs, payloadBytes: topo.payloadBytes,
    ensemble, sampleTruth: (r) => sampleRegionalHazard(r, { ...base, rho, q }), meta: { seed, rho, q, forecast },
  };
}

/* ------------------------------------------------------------------ scenario B: observed fire progression */

/** Cumulative union of observed perimeters → for a point, the interval in which the fire reached it. */
export function observedArrival(perimetersKm, point) {
  for (let k = 0; k < perimetersKm.length; k++) if (insideRings(perimetersKm[k].rings, point)) {
    return { index: k, lowerMs: k ? perimetersKm[k - 1].tMs : -Infinity, upperMs: perimetersKm[k].tMs };
  }
  return null;
}

/**
 * Causal spread forecast from data available at planning index k0 only.
 * Member: head rate v ~ LogNormal(median, σ), heading φ ~ U(0, 2π), elongation e ~ U(0, 0.9);
 * arrival at distance d, bearing θ from the burnt-area centroid: d / (v · (1 + e·cos(θ − φ)) / (1 + e)).
 * Median rate = growth of the equivalent radius √(A/π) over past perimeters; with no history a wide default.
 * These priors are fixed HYPOTHESES (see register); they were not tuned on the evaluation fires.
 */
export function fireForecastEnsemble(rng, { perimetersKm, k0, nodes, members = 64, defaultRateKmH = 0.3, sigma = 1.0, exempt }) {
  const now = perimetersKm[k0], rings = perimetersKm.slice(0, k0 + 1).flatMap((p) => p.rings);
  let cx = 0, cy = 0, count = 0;
  for (const r of now.rings) for (const [x, y] of r) { cx += x; cy += y; count++; }
  cx /= count; cy /= count;
  const rates = [];
  for (let k = 1; k <= k0; k++) {
    const dt = (perimetersKm[k].tMs - perimetersKm[k - 1].tMs) / HOUR;
    const dr = Math.sqrt(ringsArea(perimetersKm[k].rings) / Math.PI) - Math.sqrt(ringsArea(perimetersKm[k - 1].rings) / Math.PI);
    if (dt > 0.25 && dr > 0) rates.push(dr / dt);
  }
  const recent = rates.slice(-3), median = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : defaultRateKmH;
  const geo = nodes.filter((n) => !n.mobile && !exempt.has(n.id)).map((n) => ({
    id: n.id, burnt: insideRings(rings, n.pos), d: distanceToRings(now.rings, n.pos), theta: Math.atan2(n.pos[1] - cy, n.pos[0] - cx),
  }));
  return Array.from({ length: members }, () => {
    const v = median * Math.exp(sigma * gaussian(rng)), phi = 2 * Math.PI * rng(), e = 0.9 * rng();
    const nodeDeathMs = {};
    for (const g of geo) {
      const speed = (v * (1 + e * Math.cos(g.theta - phi))) / (1 + e);
      nodeDeathMs[g.id] = g.burnt ? now.tMs : Math.round(now.tMs + (g.d / Math.max(speed, 1e-6)) * HOUR);
    }
    return { nodeDeathMs };
  });
}

/**
 * Instance over a real fire: OBSERVED perimeters decide which SIMULATED nodes are lost and when.
 * `censoring`: 'mid' (default), 'early' or 'late' — where inside the observation interval the loss is placed.
 */
export function makeFireInstance({ seed, dataset, k0, members = 64, horizonMs = 12 * HOUR, censoring = 'mid', nStatic = 34, nMobile = 6, forecastOptions = {}, ...topology }) {
  const all = dataset.perimeters.flatMap((p) => p.rings.flat());
  const lon = all.map((p) => p[0]), lat = all.map((p) => p[1]);
  const lonMin = Math.min(...lon), lonMax = Math.max(...lon), latMin = Math.min(...lat), latMax = Math.max(...lat);
  const padLon = (lonMax - lonMin) * 0.25, padLat = (latMax - latMin) * 0.25;
  const toKm = projector(lonMin - padLon, latMin - padLat);
  const area = toKm([lonMax + padLon, latMax + padLat]);
  const perimetersKm = dataset.perimeters.map((p) => ({ tMs: Date.parse(p.t), rings: p.rings.map((r) => r.map(toKm)) }));
  if (!(k0 >= 0 && k0 < perimetersKm.length - 1)) throw new RangeError('k0 must leave at least one later perimeter');
  const t0 = perimetersKm[k0].tMs, rel = (ms) => Math.round(ms - t0);
  const rng = mulberry32(seed);
  const topo = buildTopology({ rng, area, nStatic, nMobile, horizonMs, ...topology });
  const arrival = new Map(topo.nodes.filter((n) => !n.mobile).map((n) => [n.id, observedArrival(perimetersKm, n.pos)]));
  for (const n of topo.nodes) { const a = arrival.get(n.id); if (a && a.index <= k0) n.powered = false; } // already burnt: known at t0
  const ends = pickEndpoints(topo.nodes, (n) => !arrival.get(n.id), rng); // endpoints never burn in the record
  if (!ends) return null;
  const exempt = new Set([ends.source, ends.destination]);
  const truthDeath = {};
  for (const [id, a] of arrival) if (a && a.index > k0) {
    const lower = Math.max(a.lowerMs, t0), t = censoring === 'early' ? lower : censoring === 'late' ? a.upperMs : (lower + a.upperMs) / 2;
    truthDeath[id] = rel(t);
  }
  const shifted = perimetersKm.map((p) => ({ ...p, tMs: rel(p.tMs) }));
  const ensemble = fireForecastEnsemble(mulberry32(seed ^ 0x51ed270b), { perimetersKm: shifted, k0, nodes: topo.nodes, members, exempt, ...forecastOptions });
  return {
    kind: 'OBSERVED_FIRE', dataClass: { hazardTruth: 'OBSERVED', topology: 'SIMULATED', forecast: 'PREDICTED' },
    nodes: topo.nodes, contacts: topo.contacts, ...ends, startMs: 0, deadlineMs: horizonMs, payloadBytes: topo.payloadBytes,
    ensemble, sampleTruth: () => ({ nodeDeathMs: truthDeath }),
    meta: { seed, incident: dataset.incident, k0, planningTime: dataset.perimeters[k0].t, censoring, areaKm: area, lostNodes: Object.keys(truthDeath).length },
    view: { perimetersKm: shifted, area },
  };
}

/* ------------------------------------------------------------------ baselines (static plans) */

/** Mirrors packages/senda router.planRoutes: successive earliest arrivals excluding the previous route's contacts except the shared first hop. Hazard-blind. */
export function cgrExclusionRoutes(problem, k) {
  const excluded = new Set(), routes = [];
  for (let i = 0; i < k; i++) {
    const r = earliestArrival(problem, { excluded });
    if (!r) break;
    routes.push(r);
    r.hops.slice(1).forEach((h) => excluded.add(h.contactId));
    if (r.hops.length === 1) excluded.add(r.hops[0].contactId);
  }
  return routes;
}

/** All static planners on one instance. Same candidates for ARR and its ablations. */
export function planAll(instance, { maxReplicas = 3, maxCandidates = 48, maxHops = 8, extra = {} } = {}) {
  const problem = buildProblem({ ...instance, maxHops });
  const ensemble = normalizeEnsemble(instance.ensemble);
  const candidates = generateCandidates(problem, ensemble, { maxCandidates });
  const run = (o) => planAdaptiveResilience({ problem, ensemble: instance.ensemble, maxReplicas, candidates, ...o }).routes;
  const marginal = (r) => ensembleReliability([r], ensemble, problem.contactById).mean;
  const plans = {
    'cgr-earliest': candidates.length ? [earliestArrival(problem)] : [],
    'cgr-k-exclusion': cgrExclusionRoutes(problem, maxReplicas),
    'top-k-marginal': [...candidates].sort((a, b) => marginal(b) - marginal(a) || (a.key < b.key ? -1 : 1)).slice(0, maxReplicas),
    'independent-greedy': run({ objective: 'independent' }),
    arr: run({}),
  };
  for (const [name, o] of Object.entries(extra)) plans[name] = o.candidates === 'fresh'
    ? planAdaptiveResilience({ problem, ensemble: instance.ensemble, maxReplicas, maxCandidates, ...o, candidates: null }).routes
    : run(o);
  return { problem, ensemble, candidates, plans };
}

/* ------------------------------------------------------------------ truth trial (common random numbers) */

/** One realised world: a truth hazard member plus one fading draw per contact, shared by every method. */
export function realise(instance, problem, rng) {
  const truth = normalizeEnsemble([instance.sampleTruth(rng)])[0];
  const fade = new Map();
  for (const c of problem.contactById.values()) fade.set(c.id, rng() < c.probabilityLowerBound * (truth.contactFactor[c.id] ?? 1));
  const hopWorks = (c, finishMs) => fade.get(c.id) && hopAlive(truth, c, finishMs);
  return { truth, hopWorks };
}

/** Execute a static replica plan: each replica advances until its first failed hop. */
export function executePlan(routes, problem, world) {
  let deliveredAtMs = null, transmissions = 0, energyMj = 0;
  for (const r of routes) {
    let ok = true;
    for (const h of r.hops) {
      const c = problem.contactById.get(h.contactId);
      transmissions++; energyMj += c.energyMj;
      if (!world.hopWorks(c, h.finishMs)) { ok = false; break; }
    }
    if (ok && (deliveredAtMs === null || r.arrivalMs < deliveredAtMs)) deliveredAtMs = r.arrivalMs;
  }
  return { delivered: deliveredAtMs !== null, deliveredAtMs, transmissions, energyMj };
}

/**
 * Dynamic forwarding over the realised contacts in time order.
 * copies = Infinity → epidemic flooding (delivery CEILING for any single-copy-per-contact scheme without re-tries);
 * finite copies → binary spray-and-wait (Spyropoulos et al. 2005).
 */
export function executeDynamic(problem, world, { copies = Infinity } = {}) {
  const { source, destination, startMs, deadlineMs, payloadBytes } = problem;
  const events = [...problem.contactById.values()].sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : 1));
  if (!Number.isFinite(copies)) { // epidemic: exact earliest arrival over the contacts that actually worked
    const at = new Map([[source, startMs]]);
    for (let changed = true; changed;) {
      changed = false;
      for (const c of events) {
        if (!at.has(c.from) || c.from === destination) continue;
        const timing = hopTiming(c, at.get(c.from), payloadBytes);
        if (!timing || timing.finishMs > deadlineMs || !world.hopWorks(c, timing.finishMs)) continue;
        if (timing.finishMs < (at.get(c.to) ?? Infinity)) { at.set(c.to, timing.finishMs); changed = true; }
      }
    }
    let tx = 0, mj = 0; // every holder offers the bundle on each feasible contact to a node that does not hold it yet
    for (const c of events) {
      if (!at.has(c.from) || c.from === destination) continue;
      const timing = hopTiming(c, at.get(c.from), payloadBytes);
      if (timing && timing.finishMs <= deadlineMs && !((at.get(c.to) ?? Infinity) < timing.departMs)) { tx++; mj += c.energyMj; }
    }
    const t = at.get(destination) ?? null;
    return { delivered: t !== null, deliveredAtMs: t, transmissions: tx, energyMj: mj };
  }
  const holds = new Map([[source, { t: startMs, copies }]]);
  let transmissions = 0, energyMj = 0, deliveredAtMs = null, progress = true;
  const done = new Set();
  while (progress) { // repeat passes so a copy received late can still use a still-open earlier-starting window
    progress = false;
    for (const c of events) {
      const from = holds.get(c.from);
      if (!from || done.has(c.id) || holds.has(c.to)) continue;
      if (c.to !== destination && from.copies <= 1) continue; // wait phase: only direct delivery
      const timing = hopTiming(c, from.t, payloadBytes);
      if (!timing || timing.finishMs > deadlineMs) continue;
      done.add(c.id); transmissions++; energyMj += c.energyMj;
      if (!world.hopWorks(c, timing.finishMs)) continue;
      const give = Number.isFinite(from.copies) ? Math.floor(from.copies / 2) : Infinity;
      if (Number.isFinite(from.copies) && c.to !== destination) from.copies -= give;
      holds.set(c.to, { t: timing.finishMs, copies: c.to === destination ? 0 : give });
      progress = true;
      if (c.to === destination) deliveredAtMs = Math.min(deliveredAtMs ?? Infinity, timing.finishMs);
    }
  }
  return { delivered: deliveredAtMs !== null, deliveredAtMs, transmissions, energyMj };
}

/* ------------------------------------------------------------------ statistics */

export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
/** Percentile bootstrap CI of the mean over instances (the statistical unit), seeded. */
export function bootstrapCi(values, { seed = 1, resamples = 2000, level = 0.95 } = {}) {
  if (!values.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const rng = mulberry32(seed), means = [];
  for (let b = 0; b < resamples; b++) { let s = 0; for (let i = 0; i < values.length; i++) s += values[Math.floor(rng() * values.length)]; means.push(s / values.length); }
  means.sort((a, b) => a - b);
  const q = (p) => means[Math.min(means.length - 1, Math.max(0, Math.floor(p * means.length)))];
  return { mean: mean(values), lo: q((1 - level) / 2), hi: q(1 - (1 - level) / 2), n: values.length };
}
/** Reliability diagram bins + expected calibration error for (prediction, observed frequency) pairs. */
export function calibration(pairs, bins = 10) {
  const table = Array.from({ length: bins }, () => ({ n: 0, predicted: 0, observed: 0 }));
  for (const [p, y] of pairs) { const b = table[Math.min(bins - 1, Math.floor(p * bins))]; b.n++; b.predicted += p; b.observed += y; }
  let ece = 0;
  for (const b of table) if (b.n) { b.predicted /= b.n; b.observed /= b.n; ece += (b.n / pairs.length) * Math.abs(b.predicted - b.observed); }
  return { ece, bins: table, brier: mean(pairs.map(([p, y]) => (p - y) ** 2)), bias: mean(pairs.map(([p, y]) => p - y)) };
}
