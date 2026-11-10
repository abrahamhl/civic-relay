/**
 * SENDA Telecom Mathematical Physics & Advanced Network Science Engine.
 *
 * Provides analytical, closed-form, and numerical formulations for:
 * 1. Continuum Percolation & Topological Phase Transitions in Fragmented Ad-Hoc Meshes.
 * 2. Markovian DTN Epidemic Spreading & Delivery Latency Bounds (P90/P99).
 * 3. ITU-R P.526-15 Extended Multi-Obstacle Deygout Knife-Edge Diffraction.
 * 4. ITU-R P.838-3 Frequency-Dependent Specific Rain Attenuation.
 * 5. Nakagami-m / Rayleigh Fading Outage Probability & Shannon Information Capacity.
 * 6. LEO Constellation Keplerian Doppler Shifts & SDR Phase-Locked Loop Bandwidth Bounds.
 *
 * Designed for government, military, and emergency civil-protection engineering.
 */

const SPEED_OF_LIGHT = 299792458; // m/s
const EARTH_RADIUS_M = 6371008.8; // WGS-84 mean radius

function finite(n, min = -Infinity, max = Infinity) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

// ---------------------------------------------------------------------------
// 1. CONTINUUM PERCOLATION & TOPOLOGICAL PHASE TRANSITIONS
// ---------------------------------------------------------------------------

/**
 * Computes the critical spatial node density (nodes/km²) required for the
 * emergence of a giant connected component (percolation threshold) in a
 * 2D random geometric graph (Gilbert disc model) over terrain.
 *
 * In 2D continuum percolation, the dimensionless critical density parameter
 * is η_c = π * λ_c * R^2 ≈ 4.512 (Meeester & Roy, 1996).
 *
 * @param {number} effectiveRangeM Effective communication radius in meters (terrain-attenuated).
 * @returns {{ criticalDensityKm2: number, etaC: number, percolationState: (densityKm2: number) => { isPercolating: boolean, densityRatio: number, giantComponentEstimate: number } }}
 */
export function computePercolationThreshold(effectiveRangeM) {
  if (!finite(effectiveRangeM, 1, 100000)) {
    throw new TypeError('effectiveRangeM must be a positive finite number (1m to 100km)');
  }
  const ETA_C = 4.512;
  const radiusKm = effectiveRangeM / 1000;
  const criticalDensityKm2 = ETA_C / (Math.PI * radiusKm * radiusKm);

  return {
    criticalDensityKm2,
    etaC: ETA_C,
    percolationState: (observedDensityKm2) => {
      if (!finite(observedDensityKm2, 0)) return { isPercolating: false, densityRatio: 0, giantComponentEstimate: 0 };
      const densityRatio = observedDensityKm2 / criticalDensityKm2;
      const isPercolating = densityRatio >= 1.0;
      // Below threshold: giant component fraction is 0. Above threshold: θ(η) ≈ 1 - exp(-c * (η - η_c))
      let giantComponentEstimate = 0;
      if (isPercolating) {
        giantComponentEstimate = Math.min(1.0, 1.0 - Math.exp(-1.25 * (densityRatio - 1.0)));
      }
      return { isPercolating, densityRatio, giantComponentEstimate };
    }
  };
}

// ---------------------------------------------------------------------------
// 2. MARKOVIAN DTN EPIDEMIC SPREADING DYNAMICS
// ---------------------------------------------------------------------------

/**
 * Computes epidemic spreading parameters and delivery latency percentiles
 * for priority emergency SOS packets across a temporal mobility contact graph.
 *
 * Mean-field SIS model with homogeneous mixing (Zhang et al., "Performance modeling of
 * epidemic routing", Computer Networks 2007):
 *   dI/dt = β · I · (N − I) − μ · I,     β = λ / (N − 1)
 * where λ is the contact rate of ONE node with ANY other node (contacts/hour/node) and
 * μ = 1/TTL + loss is the per-copy removal rate.
 *   R₀ = λ·N / ((N−1)·μ) ≈ λ/μ,   r = βN − μ (initial growth rate)
 * The solution is logistic with carrying capacity I* = N − μ/β (not N): when the target
 * fraction p exceeds I* / N the percentile is unreachable and returned as Infinity.
 *   t(p) = ln( p·(I*−1) / (I* − p·N) ) / r      (I(0) = 1)
 * Assumptions (stated, not hidden): exponential inter-contact times, homogeneous mixing,
 * no bandwidth limit per contact. Real mobility traces are heavy-tailed; treat outputs as
 * an optimistic bound to be calibrated against field traces.
 *
 * @param {number} totalNodes Total mobile nodes (vehicles, responders, gateways).
 * @param {number} contactRatePerHour Contact rate of one node with any other node (contacts/hour/node).
 * @param {number} packetTtlHours Maximum packet time-to-live in buffer before eviction.
 * @param {number} [bufferLossRate=0.02] Per-hour drop rate due to buffer contention.
 * @returns {{ r0: number, epidemicGrowthRate: number, t50Hours: number, t90Hours: number, t99Hours: number, extinctionProb: number, saturationFraction: number }}
 */
export function computeDtnEpidemicSpreading(totalNodes, contactRatePerHour, packetTtlHours, bufferLossRate = 0.02) {
  if (!finite(totalNodes, 2, 1e7) || !finite(contactRatePerHour, 0.001, 1000) || !finite(packetTtlHours, 0.1, 720) || !finite(bufferLossRate, 0, 100)) {
    throw new TypeError('Invalid input parameters for DTN epidemic spreading');
  }

  const N = totalNodes;
  const beta = contactRatePerHour / (N - 1); // pairwise contact rate
  const mu = 1.0 / packetTtlHours + bufferLossRate;
  const r0 = (beta * N) / mu;
  const r = beta * N - mu;

  let t50Hours = Infinity;
  let t90Hours = Infinity;
  let t99Hours = Infinity;
  let extinctionProb = 1.0;
  let saturationFraction = 0;

  if (r0 > 1.0 && r > 0) {
    // Linear birth-death branching approximation: P(extinction) = 1/R0.
    extinctionProb = 1.0 / r0;
    const iStar = N - mu / beta; // logistic carrying capacity
    saturationFraction = Math.max(0, Math.min(1, iStar / N));
    const tAt = (p) => {
      const target = p * N;
      if (target <= 1) return 0;
      if (target >= iStar) return Infinity;
      return Math.log((target * (iStar - 1)) / (iStar - target)) / r;
    };
    t50Hours = tAt(0.5);
    t90Hours = tAt(0.9);
    t99Hours = tAt(0.99);
  }

  const round = (x, k) => (Number.isFinite(x) ? Math.round(x * k) / k : x);
  return {
    r0: round(r0, 1000),
    epidemicGrowthRate: round(r, 1000),
    t50Hours: round(t50Hours, 100),
    t90Hours: round(t90Hours, 100),
    t99Hours: round(t99Hours, 100),
    extinctionProb: round(extinctionProb, 1000),
    saturationFraction: round(saturationFraction, 1000),
  };
}

// ---------------------------------------------------------------------------
// 3. ITU-R P.526-15 EXTENDED DEYGOUT MULTI-OBSTACLE KNIFE-EDGE DIFFRACTION
// ---------------------------------------------------------------------------

/**
 * Standard Fresnel-Kirchhoff diffraction parameter v for a single knife edge.
 * v = h * sqrt(2 * (d1 + d2) / (lambda * d1 * d2))
 */
export function computeFresnelV(hObstacleM, d1M, d2M, wavelengthM) {
  if (d1M <= 0 || d2M <= 0 || wavelengthM <= 0) return 0;
  return hObstacleM * Math.sqrt((2 * (d1M + d2M)) / (wavelengthM * d1M * d2M));
}

/**
 * ITU-R P.526-15 knife-edge diffraction loss approximation J(v) in dB.
 * J(v) = 6.9 + 20 * log10( sqrt((v - 0.1)^2 + 1) + v - 0.1 ) for v > -0.78 (ITU-R P.526-15)
 */
export function computeKnifeEdgeLossDb(v) {
  if (v <= -0.78) return 0;
  const term = Math.sqrt((v - 0.1) ** 2 + 1) + (v - 0.1);
  return term > 0 ? 6.9 + 20 * Math.log10(term) : 0;
}

const EFFECTIVE_EARTH_RADIUS_M = (4 / 3) * EARTH_RADIUS_M; // k = 4/3 standard atmosphere

/** Clearance of profile point i above the straight line joining points a and b (Earth bulge included). */
function edgeHeightAboveChord(pts, i, a, b) {
  const da = pts[i].distanceM - pts[a].distanceM;
  const db = pts[b].distanceM - pts[i].distanceM;
  const span = pts[b].distanceM - pts[a].distanceM;
  if (da <= 0 || db <= 0 || span <= 0) return { h: -Infinity, d1: da, d2: db };
  const chord = pts[a].elevationM + (da / span) * (pts[b].elevationM - pts[a].elevationM);
  const bulge = (da * db) / (2 * EFFECTIVE_EARTH_RADIUS_M);
  return { h: pts[i].elevationM + bulge - chord, d1: da, d2: db };
}

function maxNuBetween(pts, a, b, wavelength) {
  let best = { idx: -1, nu: -Infinity };
  for (let i = a + 1; i < b; i++) {
    const { h, d1, d2 } = edgeHeightAboveChord(pts, i, a, b);
    if (!Number.isFinite(h)) continue;
    const nu = computeFresnelV(h, d1, d2, wavelength);
    if (nu > best.nu) best = { idx: i, nu };
  }
  return best;
}

/**
 * Shared engine: classical Deygout construction limited to 3 edges (principal edge on the
 * Tx-Rx path, then the dominant edge on each sub-path), as described in ITU-R P.526:
 *   L = J(ν_p) + J(ν_t) + J(ν_r)
 * Effective Earth radius k = 4/3 is applied to every clearance. P.526 also gives an
 * empirical correction for closely spaced edges (Deygout over-estimates there); it is NOT
 * applied here until its coefficients are verified against the official text, so treat the
 * result as an upper-side estimate. Also returns the classical Epstein-Peterson sum over the
 * same edges (each edge referenced to its neighbouring edges), which tends to under-estimate.
 *
 * @returns {{ mainIndex:number, leftIndex:number, rightIndex:number, nuMain:number, nuLeft:number, nuRight:number,
 *   jMain:number, jLeft:number, jRight:number, deygoutDb:number, epsteinPetersonDb:number }}
 */
export function deygoutP526(terrainProfile, txElevationM, rxElevationM, totalDistanceM, frequencyHz) {
  const wavelength = SPEED_OF_LIGHT / frequencyHz;
  const inner = terrainProfile
    .filter((p) => finite(p?.distanceM) && finite(p?.elevationM) && p.distanceM > 0 && p.distanceM < totalDistanceM)
    .map((p, k) => ({ distanceM: p.distanceM, elevationM: p.elevationM, src: terrainProfile.indexOf(p) }))
    .sort((x, y) => x.distanceM - y.distanceM);
  const pts = [{ distanceM: 0, elevationM: txElevationM, src: -1 }, ...inner, { distanceM: totalDistanceM, elevationM: rxElevationM, src: -1 }];
  const last = pts.length - 1;
  const empty = { mainIndex: -1, leftIndex: -1, rightIndex: -1, nuMain: -Infinity, nuLeft: -Infinity, nuRight: -Infinity, jMain: 0, jLeft: 0, jRight: 0, deygoutDb: 0, epsteinPetersonDb: 0 };
  if (last < 2) return empty;

  const main = maxNuBetween(pts, 0, last, wavelength);
  if (main.idx < 0) return empty;
  const left = maxNuBetween(pts, 0, main.idx, wavelength);
  const right = maxNuBetween(pts, main.idx, last, wavelength);

  const jMain = computeKnifeEdgeLossDb(main.nu);
  const jLeft = left.idx >= 0 ? computeKnifeEdgeLossDb(left.nu) : 0;
  const jRight = right.idx >= 0 ? computeKnifeEdgeLossDb(right.nu) : 0;
  const deygoutDb = jMain > 0 ? jMain + jLeft + jRight : 0;

  // Epstein-Peterson over the same diffracting edges, each referenced to its neighbours.
  const edges = [0, ...(jLeft > 0 ? [left.idx] : []), main.idx, ...(jRight > 0 ? [right.idx] : []), last];
  let epsteinPetersonDb = 0;
  for (let e = 1; e < edges.length - 1; e++) {
    const { h, d1, d2 } = edgeHeightAboveChord(pts, edges[e], edges[e - 1], edges[e + 1]);
    epsteinPetersonDb += computeKnifeEdgeLossDb(computeFresnelV(h, d1, d2, wavelength));
  }

  return {
    mainIndex: pts[main.idx].src, leftIndex: left.idx >= 0 ? pts[left.idx].src : -1, rightIndex: right.idx >= 0 ? pts[right.idx].src : -1,
    nuMain: main.nu, nuLeft: left.nu, nuRight: right.nu, jMain, jLeft, jRight, deygoutDb, epsteinPetersonDb,
  };
}

/**
 * Deygout multi-obstacle diffraction (3-edge construction per ITU-R P.526, k = 4/3; no empirical correction).
 *
 * @param {Array<{ distanceM: number, elevationM: number }>} terrainProfile Elevation profile from Tx to Rx.
 * @param {number} txElevationM Tx altitude above sea level + mast height.
 * @param {number} rxElevationM Rx altitude above sea level + mast height.
 * @param {number} totalDistanceM Total link distance in meters.
 * @param {number} frequencyHz Carrier frequency in Hz.
 * @returns {{ mainObstacleIndex: number, totalDiffractionLossDb: number, obstaclesEvaluated: number, components?: object }}
 */
export function computeDeygoutDiffractionLoss(terrainProfile, txElevationM, rxElevationM, totalDistanceM, frequencyHz) {
  if (!Array.isArray(terrainProfile) || terrainProfile.length === 0 || !(totalDistanceM > 0) || !(frequencyHz > 0)) {
    return { mainObstacleIndex: -1, totalDiffractionLossDb: 0, obstaclesEvaluated: 0 };
  }
  const d = deygoutP526(terrainProfile, txElevationM, rxElevationM, totalDistanceM, frequencyHz);
  if (d.mainIndex === -1 || d.jMain <= 0) {
    return { mainObstacleIndex: -1, totalDiffractionLossDb: 0, obstaclesEvaluated: terrainProfile.length };
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  return {
    mainObstacleIndex: d.mainIndex,
    totalDiffractionLossDb: r2(d.deygoutDb),
    obstaclesEvaluated: terrainProfile.length,
    components: {
      lossMainDb: r2(d.jMain),
      lossLeftDb: r2(d.jLeft),
      lossRightDb: r2(d.jRight),
      lossEpsteinPetersonDb: r2(d.epsteinPetersonDb),
    },
  };
}

// ---------------------------------------------------------------------------
// 4. ITU-R P.838-3 FREQUENCY-DEPENDENT SPECIFIC RAIN ATTENUATION
// ---------------------------------------------------------------------------

/**
 * ITU-R P.838-3 coefficients at the tabulated frequencies (GHz): [f, kH, αH, kV, αV].
 * Transcribed from the Recommendation's frequency table; between nodes k is interpolated
 * log-log and α linearly in log f, as P.838-3 prescribes. Verify against the official ITU
 * spreadsheet before certification use.
 */
export const P838_TABLE = Object.freeze([
  [1, 0.0000259, 0.9691, 0.0000308, 0.8592],
  [2, 0.0000847, 1.0664, 0.0000998, 0.9490],
  [3, 0.0001390, 1.2322, 0.0001942, 1.0688],
  [4, 0.0001071, 1.6009, 0.0002461, 1.2476],
  [5, 0.0002162, 1.6969, 0.0002428, 1.5317],
  [6, 0.0007056, 1.5900, 0.0004878, 1.5728],
  [7, 0.001915, 1.4810, 0.001425, 1.4745],
  [8, 0.004115, 1.3905, 0.003450, 1.3797],
  [10, 0.01217, 1.2571, 0.01129, 1.2156],
  [12, 0.02386, 1.1825, 0.02455, 1.1216],
  [15, 0.04481, 1.1233, 0.05008, 1.0440],
  [20, 0.09164, 1.0568, 0.09611, 0.9847],
  [25, 0.1571, 0.9991, 0.1533, 0.9491],
  [30, 0.2403, 0.9485, 0.2291, 0.9129],
  [35, 0.3374, 0.9047, 0.3224, 0.8761],
  [40, 0.4431, 0.8673, 0.4274, 0.8421],
]);

function interpolateP838(fGhz, polarization) {
  const col = polarization === 'H' ? [1, 2] : [3, 4];
  const T = P838_TABLE;
  // Below 1 GHz: extrapolate the 1-2 GHz log-log slope (attenuation is negligible there anyway).
  let i = T.findIndex((row) => row[0] >= fGhz);
  if (i <= 0) i = 1;
  if (i === -1) i = T.length - 1;
  const lo = T[i - 1], hi = T[Math.min(i, T.length - 1)];
  const x = (Math.log10(fGhz) - Math.log10(lo[0])) / (Math.log10(hi[0]) - Math.log10(lo[0]));
  const logK = Math.log10(lo[col[0]]) + x * (Math.log10(hi[col[0]]) - Math.log10(lo[col[0]]));
  const alpha = lo[col[1]] + x * (hi[col[1]] - lo[col[1]]);
  return { k: 10 ** logK, alpha };
}

/**
 * Calculates specific rain attenuation gamma_R (dB/km) according to ITU-R P.838-3:
 * gamma_R = k * R^alpha
 *
 * Uses the tabulated ITU-R P.838-3 coefficients (H/V polarization), 1-40 GHz; below 1 GHz the
 * 1-2 GHz slope is extrapolated (values < 0.01 dB/km, operationally negligible).
 *
 * @param {number} frequencyGhz Frequency in GHz (e.g. 0.868, 2.4, 5.8, 12.0, 28.0).
 * @param {number} rainRateMmHr Rain rate in mm/hour (from MET Norway or radar).
 * @param {'H' | 'V'} [polarization='V'] Antenna polarization (Horizontal or Vertical).
 * @returns {{ specificAttenuationDbPerKm: number, pathAttenuationDb: (distanceKm: number) => number }}
 */
export function computeRainAttenuation(frequencyGhz, rainRateMmHr, polarization = 'V') {
  if (!finite(frequencyGhz, 0.1, 40) || !finite(rainRateMmHr, 0, 500)) {
    throw new TypeError('Invalid frequency (0.1-40 GHz) or rainRate (0-500 mm/h)');
  }
  if (rainRateMmHr <= 0.1) {
    return { specificAttenuationDbPerKm: 0, pathAttenuationDb: () => 0 };
  }

  const { k, alpha } = interpolateP838(frequencyGhz, polarization);
  const specificAttenuationDbPerKm = Math.round((k * Math.pow(rainRateMmHr, alpha)) * 10000) / 10000;

  return {
    specificAttenuationDbPerKm,
    pathAttenuationDb: (distanceKm) => {
      if (!finite(distanceKm, 0)) return 0;
      // Path reduction factor d_eff = d / (1 + d / d_0), d_0 = 35·exp(−0.015·R), R capped at 100 mm/h
      // (legacy ITU-R P.530-8 form; P.530-17 replaced it with a frequency-dependent fit).
      const d0 = 35 * Math.exp(-0.015 * Math.min(100, rainRateMmHr));
      const dEff = distanceKm / (1 + distanceKm / Math.max(1, d0));
      return Math.round(specificAttenuationDbPerKm * dEff * 100) / 100;
    }
  };
}

// ---------------------------------------------------------------------------
// 5. NAKAGAMI-m FADING OUTAGE & SHANNON CAPACITY
// ---------------------------------------------------------------------------

/**
 * Gamma function approximation (Lanczos) for positive real numbers.
 */
function gammaFunction(z) {
  const g = 7;
  const C = [
    0.99999999999980993, 676.52036812188514, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  z -= 1;
  let x = C[0];
  for (let i = 1; i < g + 2; i++) x += C[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * Lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a) via series expansion.
 */
function lowerIncompleteGammaNormalized(a, x) {
  if (x <= 0) return 0;
  if (x > a + 1 && x > 20) return 1.0; // asymptotic saturation
  let sum = 1.0 / a;
  let term = 1.0 / a;
  for (let n = 1; n < 100; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return (Math.pow(x, a) * Math.exp(-x) * sum) / gammaFunction(a);
}

/**
 * Computes link outage probability and Shannon capacity in Nakagami-m fading channels.
 *
 * m = 0.5: Severe fading (one-sided Gaussian)
 * m = 1.0: Rayleigh fading (non-line-of-sight multipath)
 * m >= 2.0: Rician-like fading (dominant line-of-sight component)
 *
 * @param {number} snrLinear Average Signal-to-Noise Ratio (linear scale, e.g. 10 dB -> 10.0).
 * @param {number} thresholdSnrLinear Minimum SNR for packet reception (e.g. 3 dB -> 2.0).
 * @param {number} bandwidthHz Channel bandwidth in Hz (e.g. 125 kHz LoRa, 20 MHz Wi-Fi).
 * @param {number} [mParameter=1.0] Nakagami shape parameter (default 1.0 = Rayleigh).
 * @returns {{ outageProbability: number, shannonCapacityBps: number, reliabilityPercentage: number }}
 */
export function computeFadingOutageAndCapacity(snrLinear, thresholdSnrLinear, bandwidthHz, mParameter = 1.0) {
  if (!finite(snrLinear, 0) || !finite(thresholdSnrLinear, 0) || !finite(bandwidthHz, 1) || !finite(mParameter, 0.5, 50)) {
    throw new TypeError('Invalid fading parameters');
  }

  // Outage probability P_out = P(γ < γ_th) = γ(m, m * γ_th / γ_avg) / Γ(m)
  const x = (mParameter * thresholdSnrLinear) / Math.max(1e-9, snrLinear);
  const outageProbability = Math.min(1.0, Math.max(0, lowerIncompleteGammaNormalized(mParameter, x)));

  // Ergordic Shannon capacity approximation C = B * log2(1 + SNR)
  const shannonCapacityBps = Math.round(bandwidthHz * Math.log2(1 + snrLinear));
  const reliabilityPercentage = Math.round((1 - outageProbability) * 1000) / 10;

  return {
    outageProbability: Math.round(outageProbability * 10000) / 10000,
    shannonCapacityBps,
    reliabilityPercentage,
  };
}

// ---------------------------------------------------------------------------
// 6. LEO CONSTELLATION DOPPLER SHIFT & SDR TRACKING LOOP BOUNDS
// ---------------------------------------------------------------------------

/**
 * Computes the Keplerian line-of-sight velocity, Doppler shift, and SDR PLL loop bandwidth
 * requirements for a Low Earth Orbit satellite passing above a ground terminal.
 *
 * Doppler shift: f_d(t) = - f_0 * (v_los / c)
 * Doppler rate: df_d/dt ≈ f_0 * (v_sat^2) / (c * r_min) at zenith
 *
 * @param {number} carrierFrequencyHz Carrier frequency in Hz (e.g. 137.5 MHz VHF, 437 MHz UHF, 1.6 GHz L-band).
 * @param {number} orbitAltitudeKm Satellite altitude above sea level in km (e.g. 550 km Starlink, 800 km Sentinel).
 * @param {number} elevationDeg Satellite elevation above horizon in degrees (0° to 90°).
 * @returns {{ vOrbitKmS: number, maxDopplerShiftHz: number, currentDopplerHz: number, minPllLoopBandwidthHz: number, isNarrowbandCotsFeasible: boolean }}
 */
export function computeSatelliteDopplerKinematics(carrierFrequencyHz, orbitAltitudeKm, elevationDeg) {
  if (!finite(carrierFrequencyHz, 1e6, 1e11) || !finite(orbitAltitudeKm, 100, 36000) || !finite(elevationDeg, 0, 90)) {
    throw new TypeError('Invalid orbital Doppler parameters');
  }

  // Gravitational constant G * M_earth = 398600.4418 km^3/s^2
  const GM = 398600.4418;
  const rEarthKm = EARTH_RADIUS_M / 1000;
  const rOrbitKm = rEarthKm + orbitAltitudeKm;

  // Circular orbital velocity v = sqrt(GM / r)
  const vOrbitKmS = Math.sqrt(GM / rOrbitKm);
  const vOrbitMS = vOrbitKmS * 1000;

  // Overhead pass, circular orbit, Earth rotation neglected (±0.46 km/s at the equator):
  // range-rate ṙ = v_orbit · (R_E / r_orbit) · cos(elevation)  → maximum at the horizon
  const maxLosVelocityMS = vOrbitMS * (rEarthKm / rOrbitKm);
  const maxDopplerShiftHz = Math.round((carrierFrequencyHz * maxLosVelocityMS) / SPEED_OF_LIGHT);

  // Line-of-sight velocity at current elevation:
  // As elevation increases to 90° (zenith), v_los approaches 0 (Doppler shift crosses zero)
  const elevRad = (elevationDeg * Math.PI) / 180;
  const currentLosVelocityMS = maxLosVelocityMS * Math.cos(elevRad);
  const currentDopplerHz = Math.round((carrierFrequencyHz * currentLosVelocityMS) / SPEED_OF_LIGHT);

  // Maximum Doppler rate occurs at closest approach (zenith pass):
  // df_d/dt_max ≈ f_0 * v_orbit^2 / (c * h_min)
  const hMinM = orbitAltitudeKm * 1000;
  const maxDopplerRateHzPerS = (carrierFrequencyHz * vOrbitMS * vOrbitMS) / (SPEED_OF_LIGHT * hMinM);

  // Second-order PLL under a frequency ramp Ḟ (Hz/s): steady-state phase error
  //   θ_e = 2π·Ḟ / ω_n²  (Gardner, Phaselock Techniques, 3rd ed., §6)
  // Allocating θ_e ≤ 15° to dynamic stress (rule of thumb in Kaplan & Hegarty §5.3) and ζ = 0.707:
  //   ω_n ≥ sqrt(2π·Ḟ / θ_max),   B_L = ω_n·(ζ + 1/(4ζ))/2 ≈ 0.53·ω_n  (one-sided noise bandwidth, Hz)
  const THETA_MAX_RAD = (15 * Math.PI) / 180;
  const ZETA = Math.SQRT1_2;
  const omegaN = Math.sqrt((2 * Math.PI * maxDopplerRateHzPerS) / THETA_MAX_RAD);
  const minPllLoopBandwidthHz = Math.round(((omegaN * (ZETA + 1 / (4 * ZETA))) / 2) * 10) / 10;

  // COTS narrowband terminals without AFC typically lose synchronization if |f_d| > 5 kHz
  const isNarrowbandCotsFeasible = Math.abs(currentDopplerHz) <= 5000;

  return {
    vOrbitKmS: Math.round(vOrbitKmS * 100) / 100,
    maxDopplerShiftHz,
    currentDopplerHz,
    maxDopplerRateHzPerS: Math.round(maxDopplerRateHzPerS * 100) / 100,
    minPllLoopBandwidthHz,
    isNarrowbandCotsFeasible,
  };
}
