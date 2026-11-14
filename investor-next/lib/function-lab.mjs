/**
 * SENDA function lab — deterministic, dependency-free mathematics.
 *
 * Every function here is a MODEL. Nothing contacts a network, dispatches an
 * alert, reads a radio or measures the physical world. Where a real-world
 * quantity is approximated (delivery probability, coverage, energy), the
 * assumptions are declared next to the formula and the UI must keep saying so.
 *
 * Design rules:
 *  - pure functions, no Date/Math.random inside (seeded PRNG only);
 *  - explicit input validation, throwing RangeError on nonsense;
 *  - results carry their own provenance string.
 */

export const LAB_PROVENANCE = 'MODEL_DERIVED_EXERCISE_ONLY';

const assertFinite = (name, value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** Mulberry32: small, seedable, reproducible PRNG for Monte Carlo. */
export function mulberry32(seed) {
  assertFinite('seed', seed);
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 1. Alert propagation on a contact graph (compartmental SIR) -----------
//
// Treats awareness/alert carrying the way epidemiology treats infection: a
// relaying device "infects" reachable neighbours with an effective rate.
// beta = per-contact transmission prob, gamma = recovery (device stops
// relaying) rate. R0 = beta / gamma. This is a MODEL of message spread, not
// proof any device is reachable.

/**
 * @param {Object} p
 * @param {number} p.population  virtual nodes (>=1)
 * @param {number} p.contacts    mean contacts per node (>=0)
 * @param {number} p.beta        transmission prob per step (0..1)
 * @param {number} p.gamma       recovery rate per step (0..1)
 * @param {number} p.steps       number of time steps (>=1)
 * @param {number} [p.seed]
 * @param {number} [p.initial]   initially informed nodes
 * @returns {Object}
 */
export function alertPropagation({ population, contacts, beta, gamma, steps, seed = 1, initial = 1 }) {
  assertFinite('population', population);
  assertFinite('contacts', contacts);
  assertFinite('beta', beta);
  assertFinite('gamma', gamma);
  assertFinite('steps', steps);
  if (population < 1) throw new RangeError('population must be >= 1');
  if (contacts < 0) throw new RangeError('contacts must be >= 0');
  if (!(beta >= 0 && beta <= 1)) throw new RangeError('beta must be in [0,1]');
  if (!(gamma > 0 && gamma <= 1)) throw new RangeError('gamma must be in (0,1]');
  if (steps < 1) throw new RangeError('steps must be >= 1');

  const rng = mulberry32(seed);
  let S = population - clamp(initial, 0, population);
  let I = clamp(initial, 0, population);
  let R = 0;
  const series = [{ step: 0, susceptible: S, informed: I, recovered: R, cumulativeInformed: clamp(initial, 0, population) }];

  for (let step = 1; step <= steps; step += 1) {
    // Expected fraction of susceptibles that meet at least one informed node,
    // using a homogeneous-mixing contact model.
    const force = 1 - Math.exp((-beta * contacts * I) / population);
    // Deterministic expected value plus a small seeded jitter so runs differ by
    // seed but remain reproducible.
    const jitter = (rng() - 0.5) * 0.02;
    const newI = clamp(S * (force + jitter * force), 0, S);
    const recovered = clamp(I * gamma, 0, I);
    S = clamp(S - newI, 0, population);
    R += recovered;
    I = clamp(I + newI - recovered, 0, population);
    series.push({
      step,
      susceptible: S,
      informed: I,
      recovered: R,
      cumulativeInformed: population - S,
    });
  }

  const r0 = (contacts * beta) / gamma;
  return {
    r0,
    peakInformed: series.reduce((m, p) => Math.max(m, p.informed), 0),
    finalCumulative: population - S,
    attackRate: (population - S) / population,
    series,
    provenance: LAB_PROVENANCE,
    assumptions: [
      'grafo de contactos homogéneo (mezcla perfecta)',
      'tasa de transmisión constante por paso',
      'sin latencia de propagación ni pérdida de enlace',
    ],
  };
}

// --- 2. Multi-objective adaptive routing (Pareto-optimal paths) ------------
//
// A route is scored on two objectives: energy to deliver and expected
// latency. We compute every Pareto-optimal path (no other path beats it on
// both) instead of collapsing to a single weighted sum, so the UI can show
// the real trade-off frontier.

/**
 * @param {Object} graph
 * @param {string} start
 * @param {string} goal
 * @returns {Array<{path:string[], energy:number, latencyMs:number}>}
 */
export function paretoRoutes(graph, start, goal) {
  if (!graph || typeof graph !== 'object' || !graph.nodes) {
    throw new TypeError('graph with nodes/edges required');
  }
  const nodes = graph.nodes;
  for (const id of [start, goal]) {
    if (!nodes[id]) throw new RangeError(`unknown node ${id}`);
  }

  const partial = [{ path: [start], energy: 0, latencyMs: 0 }];
  const complete = [];
  const seen = new Map();

  const dominates = (a, b) =>
    a.energy <= b.energy && a.latencyMs <= b.latencyMs &&
    (a.energy < b.energy || a.latencyMs < b.latencyMs);

  let guard = 0;
  while (partial.length && guard < 100000) {
    guard += 1;
    partial.sort((a, b) => a.energy + a.latencyMs / 1000 - (b.energy + b.latencyMs / 1000));
    const current = partial.shift();
    const last = current.path[current.path.length - 1];
    if (last === goal) {
      complete.push(current);
      continue;
    }
    const edges = nodes[last]?.edges ?? {};
    for (const [next, cost] of Object.entries(edges)) {
      if (current.path.includes(next)) continue;
      const candidate = {
        path: [...current.path, next],
        energy: current.energy + cost.energy,
        latencyMs: current.latencyMs + cost.latencyMs,
      };
      const key = candidate.path.join('>');
      const prior = seen.get(key);
      if (prior && prior.energy <= candidate.energy && prior.latencyMs <= candidate.latencyMs) {
        continue;
      }
      seen.set(key, candidate);
      partial.push(candidate);
    }
  }

  const frontier = [];
  for (const candidate of complete) {
    if (!frontier.some((other) => dominates(other, candidate))) {
      frontier.push(candidate);
    }
  }
  return frontier
    .filter((candidate) => !frontier.some((other) => other !== candidate && dominates(other, candidate)))
    .sort((a, b) => a.energy - b.energy || a.latencyMs - b.latencyMs);
}

export function makeDemoGraph() {
  const e = (energy, latencyMs, secure = true) => ({ energy, latencyMs, secure });
  return {
    open: true,
    nodes: {
      ORIGIN: { edges: { BLE_1: e(1, 40), WIFI_1: e(2, 15), GATEWAY: e(5, 200) } },
      BLE_1: { edges: { BLE_2: e(1, 45), WIFI_1: e(1.5, 30) } },
      BLE_2: { edges: { RELAY: e(1, 50) } },
      WIFI_1: { edges: { WIFI_2: e(1.2, 20), RELAY: e(2.5, 25) } },
      WIFI_2: { edges: { RELAY: e(1, 18) } },
      GATEWAY: { edges: { RELAY: e(1, 60) } },
      RELAY: { edges: {} },
    },
  };
}

// --- 3. Delivery probability under retry backoff (Monte Carlo) -------------
//
// Each attempt succeeds independently with probability p. k attempts are made.
// P(delivery within k) = 1 - (1-p)^k (closed form) and we also estimate it by
// simulation to show sampling error. Expected attempts to success = 1/p.

export function deliveryProbabilityClosedForm({ perAttempt, attempts }) {
  assertFinite('perAttempt', perAttempt);
  assertFinite('attempts', attempts);
  if (!(perAttempt > 0 && perAttempt <= 1)) throw new RangeError('perAttempt must be in (0,1]');
  if (attempts < 1) throw new RangeError('attempts must be >= 1');
  return 1 - Math.pow(1 - perAttempt, attempts);
}

export function deliveryMonteCarlo({ perAttempt, attempts, trials = 20000, seed = 7 }) {
  assertFinite('perAttempt', perAttempt);
  assertFinite('trials', trials);
  if (trials < 1) throw new RangeError('trials must be >= 1');
  const rng = mulberry32(seed);
  let delivered = 0;
  let totalAttempts = 0;
  for (let t = 0; t < trials; t += 1) {
    let done = false;
    for (let k = 0; k < attempts; k += 1) {
      totalAttempts += 1;
      if (rng() < perAttempt) {
        delivered += 1;
        done = true;
        break;
      }
    }
    if (!done) {
      // count all attempts even on failure
    }
  }
  const p = delivered / trials;
  const stdErr = Math.sqrt((p * (1 - p)) / trials);
  return {
    probability: p,
    closedForm: deliveryProbabilityClosedForm({ perAttempt, attempts }),
    stdErr,
    ci95: [clamp(p - 1.96 * stdErr, 0, 1), clamp(p + 1.96 * stdErr, 0, 1)],
    meanAttempts: totalAttempts / trials,
    expectedAttemptsClosedForm: 1 / perAttempt,
    provenance: LAB_PROVENANCE,
  };
}

// --- 4. Sensor coverage & information value --------------------------------
//
// A ring of sensors with limited aperture covers an angular field. We compute
// the union-covered fraction and, treating a detected event as a random
// variable over the field, the Shannon entropy of the covered distribution as
// a proxy for situational uncertainty. Zero coverage => zero entropy
// reduction; full coverage => maximal information.

export function coverageEntropy({ sensorCount, halfAngleDeg, rangeKm, fieldRadiusKm }) {
  assertFinite('sensorCount', sensorCount);
  assertFinite('halfAngleDeg', halfAngleDeg);
  assertFinite('rangeKm', rangeKm);
  assertFinite('fieldRadiusKm', fieldRadiusKm);
  if (sensorCount < 1) throw new RangeError('sensorCount must be >= 1');
  if (!(halfAngleDeg > 0 && halfAngleDeg <= 180)) throw new RangeError('halfAngleDeg must be in (0,180]');
  if (!(rangeKm > 0)) throw new RangeError('rangeKm must be positive');
  if (!(fieldRadiusKm > 0)) throw new RangeError('fieldRadiusKm must be positive');

  // Fraction of the disk area within each sensor's reachable wedge, combined
  // conservatively (1 - product of misses) to avoid double-counting overlap.
  const wedgeArea = (Math.PI * rangeKm * rangeKm) * (halfAngleDeg / 180);
  const fieldArea = Math.PI * fieldRadiusKm * fieldRadiusKm;
  const perSensorFraction = clamp(wedgeArea / fieldArea, 0, 1);
  const coveredFraction = 1 - Math.pow(1 - perSensorFraction, sensorCount);

  // Coverage shrinks the region where an event could hide. If the field is
  // uniform and only the blind fraction remains unobserved, the search space
  // reduction in bits is log2(1/blindFraction). Binary entropy is deliberately
  // NOT used: it peaks at p=0.5 and would punish better coverage.
  const blindFraction = clamp(1 - coveredFraction, 0, 1);
  const searchSpaceReductionBits = blindFraction >= 1 ? 0 : -Math.log2(Math.max(blindFraction, 1e-9));
  return {
    coveredFraction,
    perSensorFraction,
    blindFraction,
    searchSpaceReductionBits,
    provenance: LAB_PROVENANCE,
    assumptions: [
      'detector ideal dentro del cono y del radio',
      'solape combinado como independiente (cota conservadora)',
      'terreno plano sin oclusión',
      'reducción en bits = log2(1 / fracción ciega)',
    ],
  };
}

// --- 5. Energy-aware transmission schedule --------------------------------
//
// Given a battery budget and per-message energy, how many messages can be sent
// and at what duty cycle to survive a target duration. Sleep dominates cost, so
// duty cycle is the lever.

export function energyBudget({ batteryWh, txSeconds, txPowerW, sleepPowerW, intervalS, targetHours }) {
  assertFinite('batteryWh', batteryWh);
  assertFinite('txSeconds', txSeconds);
  assertFinite('txPowerW', txPowerW);
  assertFinite('sleepPowerW', sleepPowerW);
  assertFinite('intervalS', intervalS);
  assertFinite('targetHours', targetHours);
  if (batteryWh <= 0) throw new RangeError('batteryWh must be positive');
  if (!(txSeconds > 0 && txSeconds <= intervalS)) throw new RangeError('txSeconds must be in (0, intervalS]');
  if (txPowerW < 0 || sleepPowerW < 0) throw new RangeError('powers must be >= 0');
  if (intervalS <= 0) throw new RangeError('intervalS must be positive');
  if (targetHours <= 0) throw new RangeError('targetHours must be positive');

  const dutyCycle = txSeconds / intervalS;
  const avgPowerW = txPowerW * dutyCycle + sleepPowerW * (1 - dutyCycle);
  const energyPerMessageWh = (txPowerW * txSeconds) / 3600;
  const runtimeHours = batteryWh / avgPowerW;
  const messages = Math.floor(batteryWh / Math.max(energyPerMessageWh, 1e-9));
  return {
    dutyCycle,
    avgPowerW,
    runtimeHours,
    messages,
    targetMet: runtimeHours >= targetHours,
    marginHours: runtimeHours - targetHours,
    provenance: LAB_PROVENANCE,
    assumptions: [
      'consumo de transmisión constante durante el envío',
      'sin coste de arranque, sin fugas, sin degradación de batería',
      'un único mensaje por intervalo',
    ],
  };
}

// --- 6. Node tracking: 1-D Kalman filter -----------------------------------
//
// Linear constant-velocity tracker for a single coordinate. Real sensors give
// noisy position; the filter fuses model and measurement to produce a smoother
// estimate. Process noise q, measurement noise r on the diagonal.

export function kalmanFilter1D({ points, q, r, start = 0, startVelocity = 0 }) {
  if (!Array.isArray(points) || points.length === 0) throw new RangeError('points must be a non-empty array');
  for (const value of points) assertFinite('point', value);
  if (!(q >= 0)) throw new RangeError('q must be >= 0');
  if (!(r > 0)) throw new RangeError('r must be positive');

  // State [position, velocity]^T, model x' = x + v*dt with dt = 1.
  let pos = start;
  let vel = startVelocity;
  let p00 = 1;
  let p01 = 0;
  let p10 = 0;
  let p11 = 1;
  const trace = [];

  for (let i = 0; i < points.length; i += 1) {
    // Predict: x = F x, P = F P F^T + Q with F = [[1, 1], [0, 1]].
    const predPos = pos + vel;
    const predVel = vel;
    const pp00 = p00 + p01 + p10 + p11 + q;
    const pp01 = p01 + p11;
    const pp11 = p11 + q;
    // Update with measurement z = points[i]. H = [1, 0].
    const z = points[i];
    const s = pp00 + r;
    const k0 = pp00 / s;
    const k1 = pp01 / s;
    const innovation = z - predPos;
    pos = predPos + k0 * innovation;
    vel = predVel + k1 * innovation;
    const old00 = pp00;
    const old01 = pp01;
    const old11 = pp11;
    // P = (I - K H) P using the predicted covariance.
    p00 = (1 - k0) * old00;
    p01 = (1 - k0) * old01;
    p10 = old01 - k1 * old00;
    p11 = old11 - k1 * old01;
    trace.push({ z, estimate: pos, velocity: vel, gain: k0, variance: p00 });
  }

  return { trace, finalEstimate: pos, finalVelocity: vel, provenance: LAB_PROVENANCE };
}

// --- 7. Consolidated function-by-function scorecard ------------------------
//
// One number per pillar so the UI can show "how much of the model is honest and
// bounded" at a glance. Purely a presentation aid over the functions above.

export function functionScorecard() {
  return [
    { id: 'alert', label: 'Difusión de alertas', model: 'SIR compartimental', status: 'MODELO', tested: true },
    { id: 'routing', label: 'Enrutamiento adaptativo', model: 'Frontera de Pareto', status: 'MODELO', tested: true },
    { id: 'delivery', label: 'Entrega con reintentos', model: 'Monte Carlo + forma cerrada', status: 'MODELO', tested: true },
    { id: 'coverage', label: 'Cobertura de sensores', model: 'Unión de conos + entropía', status: 'MODELO', tested: true },
    { id: 'energy', label: 'Presupuesto de energía', model: 'Ciclo de trabajo', status: 'MODELO', tested: true },
    { id: 'tracking', label: 'Seguimiento de nodo', model: 'Filtro de Kalman 1-D', status: 'MODELO', tested: true },
    { id: 'bayes', label: 'Fiabilidad de portador', model: 'Beta-Binomial + Thompson', status: 'MODELO', tested: true },
    { id: 'erasure', label: 'Entrega k-de-n', model: 'Cola binomial exacta', status: 'MODELO', tested: true },
    { id: 'dtn', label: 'Retardo DTN', model: 'Inter-contacto exponencial', status: 'MODELO', tested: true },
    { id: 'ranging', label: 'Rango por RSSI', model: 'Log-distancia + CRLB', status: 'MODELO', tested: true },
    { id: 'seir', label: 'Epidemia SEIR', model: 'RK45 adaptativo', status: 'MODELO', tested: true },
    { id: 'crypto', label: 'Integridad de firma', model: 'WebCrypto ECDSA P-256', status: 'REAL_EN_NAVEGADOR', tested: true },
    { id: 'radio', label: 'Radio física / SOS / 112', model: 'no implementado', status: 'NO_IMPLEMENTADO', tested: false },
  ];
}
