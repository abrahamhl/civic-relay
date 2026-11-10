/**
 * SENDA Scientific Theorems & Advanced Mathematical Physics Engine.
 *
 * Implements deterministic IEEE-754 double-precision numerical models. "Theorem N" is the
 * historical section name; these are established published results (Al-Hourani 2014,
 * Fiedler 1973, ITU-R P.526, Kay 1993, ISO 9613-1) applied to SENDA, not new theorems.
 * 1. Theorem 1: Al-Hourani A2G Optimal Drone Altitude via Transcendental Root-Finding.
 * 2. Theorem 2: Swarm Graph Laplacian, Fiedler Algebraic Connectivity (λ₂) & Perturbation Gradient.
 * 3. Theorem 3: Deygout ITU-R P.526-15 Recursive Multi-Obstacle Diffraction vs Epstein-Peterson.
 * 4. Theorem 4: Passive Bistatic Radar (PBR) Ambiguity & Cramér-Rao Lower Bounds (CRLB).
 * 5. Theorem 5: Near-Ultrasound (18-20 kHz) Acoustic Capacity under Severe Catastrophe Noise (85 dBA).
 */

import { deygoutP526 } from './telecom-mathematical-physics.mjs';

export const SPEED_OF_LIGHT = 299792458; // m/s

function finite(n, min = -Infinity, max = Infinity) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

// ---------------------------------------------------------------------------
// 1. THEOREM 1: AL-HOURANI OPTIMAL DRONE ALTITUDE
// ---------------------------------------------------------------------------

export const A2G_MORPHOLOGY = Object.freeze({
  SUBURBAN: { a: 4.88, b: 0.43, etaLos: 0.1, etaNlos: 21.0, label: 'Suburbano / Campo' },
  URBAN: { a: 9.61, b: 0.16, etaLos: 1.0, etaNlos: 20.0, label: 'Urbano Estándar' },
  DENSE_URBAN: { a: 12.08, b: 0.11, etaLos: 1.6, etaNlos: 23.0, label: 'Urbano Denso' },
  // Al-Hourani 'high-rise urban' parameters, used as an UNVALIDATED proxy for rubble canyons.
  CANYON_RUBBLE: { a: 27.23, b: 0.08, etaLos: 2.3, etaNlos: 34.0, label: 'Urbano de gran altura (proxy no validado de escombros)' },
});

/**
 * Computes LoS probability given elevation angle in degrees.
 */
export function pLosAtElevationDeg(thetaDeg, env) {
  const exponent = -env.b * (thetaDeg - env.a);
  return 1.0 / (1.0 + env.a * Math.exp(exponent));
}

/**
 * Solves the transcendental equation for optimal elevation angle θ* [deg] using Newton-Raphson.
 *
 * f(θ) = tan(θ) - (9 * ln(10) / π) * (η_NLoS - η_LoS) * b * P_LoS(θ) * (1 - P_LoS(θ)) = 0
 *
 * @param {keyof typeof A2G_MORPHOLOGY} [envType='URBAN']
 * @returns {number} Optimal elevation angle in degrees.
 */
export function solveOptimalElevationAngleDeg(envType = 'URBAN') {
  const env = A2G_MORPHOLOGY[envType] || A2G_MORPHOLOGY.URBAN;
  const K = (9 * Math.log(10) / Math.PI) * (env.etaNlos - env.etaLos) * env.b;

  // Initial guess based on environment
  let thetaDeg = envType === 'SUBURBAN' ? 20 : envType === 'URBAN' ? 40 : envType === 'DENSE_URBAN' ? 55 : 68;

  for (let iter = 0; iter < 100; iter++) {
    const thetaRad = (thetaDeg * Math.PI) / 180;
    const tanVal = Math.tan(thetaRad);
    const p = pLosAtElevationDeg(thetaDeg, env);
    const dp = p * (1.0 - p); // derivative factor

    const f = tanVal - K * dp;

    // Numerical derivative df/dtheta
    const eps = 1e-5;
    const thetaRadEps = ((thetaDeg + eps) * Math.PI) / 180;
    const pEps = pLosAtElevationDeg(thetaDeg + eps, env);
    const fEps = Math.tan(thetaRadEps) - K * (pEps * (1.0 - pEps));
    const df = (fEps - f) / eps;

    const delta = f / df;
    thetaDeg -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }

  return Math.max(5.0, Math.min(85.0, thetaDeg));
}

/**
 * Evaluates the full A2G path loss curve and returns the optimal hovering altitude h*.
 *
 * @param {number} radiusM Horizontal ground radius in meters (e.g. 1000m).
 * @param {keyof typeof A2G_MORPHOLOGY} [envType='URBAN']
 * @param {number} [frequencyHz=868e6]
 * @returns {{
 *   optimalElevationDeg: number,
 *   optimalAltitudeM: number,
 *   optimalPathLossDb: number,
 *   pLosAtOptimal: number,
 *   lossVsFixed50mDb: number,
 *   curvePoints: Array<{ altitudeM: number, elevationDeg: number, pathLossDb: number, pLos: number }>
 * }}
 */
export function computeAlHouraniOptimalAltitude(radiusM, envType = 'URBAN', frequencyHz = 868e6) {
  if (!finite(radiusM, 10, 50000)) throw new TypeError('radiusM must be between 10m and 50km');
  const env = A2G_MORPHOLOGY[envType] || A2G_MORPHOLOGY.URBAN;

  const optimalElevationDeg = solveOptimalElevationAngleDeg(envType);
  const optimalElevationRad = (optimalElevationDeg * Math.PI) / 180;
  const optimalAltitudeM = radiusM * Math.tan(optimalElevationRad);

  const calcPl = (h) => {
    const d3d = Math.sqrt(h * h + radiusM * radiusM);
    const fspl = 20 * Math.log10((4 * Math.PI * frequencyHz * d3d) / SPEED_OF_LIGHT);
    const elev = (Math.atan(h / radiusM) * 180) / Math.PI;
    const pLos = pLosAtElevationDeg(elev, env);
    const excess = pLos * env.etaLos + (1.0 - pLos) * env.etaNlos;
    return { pl: fspl + excess, pLos, elev };
  };

  const optRes = calcPl(optimalAltitudeM);
  const fixed50Res = calcPl(50);

  // Generate 20 sampling points along the altitude curve
  const curvePoints = [];
  const minH = Math.max(10, optimalAltitudeM * 0.1);
  const maxH = optimalAltitudeM * 2.5;
  const step = (maxH - minH) / 20;

  for (let h = minH; h <= maxH; h += step) {
    const res = calcPl(h);
    curvePoints.push({
      altitudeM: Math.round(h * 10) / 10,
      elevationDeg: Math.round(res.elev * 100) / 100,
      pathLossDb: Math.round(res.pl * 100) / 100,
      pLos: Math.round(res.pLos * 1000) / 1000,
    });
  }

  return {
    optimalElevationDeg: Math.round(optimalElevationDeg * 100) / 100,
    optimalAltitudeM: Math.round(optimalAltitudeM * 10) / 10,
    optimalPathLossDb: Math.round(optRes.pl * 100) / 100,
    pLosAtOptimal: Math.round(optRes.pLos * 1000) / 1000,
    lossVsFixed50mDb: Math.round((fixed50Res.pl - optRes.pl) * 100) / 100,
    curvePoints,
  };
}

// ---------------------------------------------------------------------------
// 2. THEOREM 2: SWARM GRAPH LAPLACIAN & FIEDLER EIGENVALUE GRADIENT
// ---------------------------------------------------------------------------

/**
 * Computes the eigenvalues and Fiedler eigenvector of a symmetric Laplacian matrix.
 * Uses Jacobi eigenvalue iteration (exact, stable for N <= 100).
 *
 * @param {number[][]} adjMatrix Symmetric NxN adjacency matrix with weights in [0, 1].
 * @returns {{
 *   eigenvalues: number[],
 *   fiedlerValue: number,
 *   fiedlerVector: number[],
 *   cheegerLowerBound: number,
 *   optimalLinksToBoost: Array<{ from: number, to: number, gradient: number }>
 * }}
 */
export function computeGraphLaplacianSpectrum(adjMatrix) {
  const N = adjMatrix.length;
  if (!Array.isArray(adjMatrix) || N < 2 || N > 200 || adjMatrix.some((r) => !Array.isArray(r) || r.length !== N)) {
    throw new TypeError('adjMatrix must be a square matrix between 2x2 and 200x200');
  }

  // Construct Laplacian L = D - A
  const L = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    let degree = 0;
    for (let j = 0; j < N; j++) {
      if (i !== j) {
        const w = Math.max(0, ((adjMatrix[i][j] || 0) + (adjMatrix[j][i] || 0)) / 2); // symmetrise
        L[i][j] = -w;
        degree += w;
      }
    }
    L[i][i] = degree;
  }

  // Jacobi Eigenvalue Algorithm on symmetric L
  const V = Array.from({ length: N }, (_, i) => {
    const row = Array(N).fill(0);
    row[i] = 1.0;
    return row;
  });
  const A_mat = L.map(r => [...r]);

  // Classical Jacobi converges quadratically once off-diagonals are small; the bound below
  // is generous (≈ 50 sweeps of N²/2 rotations) and the loop exits on the 1e-12 tolerance.
  const maxRotations = 50 * N * N;
  let converged = false;
  for (let iter = 0; iter < maxRotations; iter++) {
    let maxOff = 0;
    let p = 0, q = 1;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const absVal = Math.abs(A_mat[i][j]);
        if (absVal > maxOff) {
          maxOff = absVal;
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-12) { converged = true; break; }

    const diff = A_mat[q][q] - A_mat[p][p];
    let t;
    if (Math.abs(diff) < 1e-12) {
      t = 1.0;
    } else {
      const phi = diff / (2.0 * A_mat[p][q]);
      t = 1.0 / (Math.abs(phi) + Math.sqrt(phi * phi + 1.0));
      if (phi < 0) t = -t;
    }
    const c = 1.0 / Math.sqrt(t * t + 1.0);
    const s = t * c;
    const tau = s / (1.0 + c);

    const a_pq = A_mat[p][q];
    A_mat[p][q] = 0;
    A_mat[q][p] = 0;
    A_mat[p][p] -= t * a_pq;
    A_mat[q][q] += t * a_pq;

    for (let j = 0; j < N; j++) {
      if (j !== p && j !== q) {
        const a_jp = A_mat[j][p];
        const a_jq = A_mat[j][q];
        A_mat[j][p] = a_jp - s * (a_jq + tau * a_jp);
        A_mat[p][j] = A_mat[j][p];
        A_mat[j][q] = a_jq + s * (a_jp - tau * a_jq);
        A_mat[q][j] = A_mat[j][q];
      }
    }
    for (let j = 0; j < N; j++) {
      const v_jp = V[j][p];
      const v_jq = V[j][q];
      V[j][p] = v_jp - s * (v_jq + tau * v_jp);
      V[j][q] = v_jq + s * (v_jp - tau * v_jq);
    }
  }

  // Extract eigenvalues and associated eigenvector columns
  const pairs = [];
  for (let i = 0; i < N; i++) {
    const val = Math.max(0, A_mat[i][i]);
    const vec = V.map(row => row[i]);
    pairs.push({ val, vec });
  }
  pairs.sort((a, b) => a.val - b.val);
  if (!converged) throw new RangeError(`Jacobi eigen-solver did not converge for N=${N}`);

  const eigenvalues = pairs.map(p => Math.round(p.val * 10000) / 10000);
  const fiedlerValue = pairs[1].val;
  const fiedlerVector = pairs[1].vec.map(v => Math.round(v * 10000) / 10000);

  // Compute perturbation gradient: d(λ₂)/d(w_ij) = (v₂(i) - v₂(j))²
  const optimalLinksToBoost = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const currentWeight = adjMatrix[i][j] || 0;
      if (currentWeight < 0.95) {
        const diff = pairs[1].vec[i] - pairs[1].vec[j];
        const gradient = diff * diff;
        optimalLinksToBoost.push({
          from: i,
          to: j,
          currentWeight: Math.round(currentWeight * 100) / 100,
          gradient: Math.round(gradient * 10000) / 10000,
        });
      }
    }
  }
  optimalLinksToBoost.sort((a, b) => b.gradient - a.gradient);

  return {
    eigenvalues,
    fiedlerValue: Math.round(fiedlerValue * 10000) / 10000,
    fiedlerVector,
    cheegerLowerBound: Math.round((fiedlerValue / 2.0) * 10000) / 10000,
    optimalLinksToBoost: optimalLinksToBoost.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// 3. THEOREM 3: DEYGOUT CASCADE MULTI-OBSTACLE DIFFRACTION (ITU-R P.526-15)
// ---------------------------------------------------------------------------

/**
 * Evaluates single knife-edge diffraction loss in dB given Fresnel parameter ν.
 */
export function knifeEdgeLossDb(nu) {
  if (nu <= -0.78) return 0.0;
  const inner = Math.sqrt((nu - 0.1) * (nu - 0.1) + 1.0) + nu - 0.1;
  return 6.9 + 20.0 * Math.log10(Math.max(1e-6, inner));
}

/**
 * Deygout multi-obstacle diffraction (3-edge construction per ITU-R P.526, k = 4/3 Earth
 * bulge, no empirical correction) compared with the classical Epstein-Peterson construction over the
 * same edges. Both share one engine (`deygoutP526`) with the telecom module so the two
 * public APIs cannot drift apart.
 *
 * Note on the comparison: neither method is "the truth". Epstein-Peterson tends to
 * UNDER-estimate loss for closely spaced edges and Deygout tends to OVER-estimate it, so the
 * two bracket the true value. `epsteinOverestimationDb` is simply EP − Deygout (normally ≤ 0;
 * the historical field name is kept for API compatibility).
 *
 * @param {Array<{ distanceM: number, elevationM: number }>} terrainProfile
 * @param {number} txElevationM
 * @param {number} rxElevationM
 * @param {number} totalDistanceM
 * @param {number} [frequencyHz=868e6]
 */
export function computeDeygoutMultiObstacleDiffraction(
  terrainProfile,
  txElevationM,
  rxElevationM,
  totalDistanceM,
  frequencyHz = 868e6
) {
  if (!Array.isArray(terrainProfile) || terrainProfile.length === 0) {
    throw new TypeError('terrainProfile must be a non-empty array');
  }
  if (!finite(totalDistanceM, 1) || !finite(frequencyHz, 1e6, 1e11)) {
    throw new TypeError('totalDistanceM and frequencyHz must be positive and finite');
  }
  const wavelength = SPEED_OF_LIGHT / frequencyHz;
  const d = deygoutP526(terrainProfile, txElevationM, rxElevationM, totalDistanceM, frequencyHz);

  const obstacles = terrainProfile.map((obs, idx) => {
    const d1 = obs.distanceM;
    const d2 = totalDistanceM - d1;
    const valid = d1 > 0 && d2 > 0;
    const losLineHeight = txElevationM + (rxElevationM - txElevationM) * (d1 / totalDistanceM);
    const hEff = obs.elevationM - losLineHeight;
    const nu = valid ? hEff * Math.sqrt((2.0 * totalDistanceM) / (wavelength * d1 * d2)) : -Infinity;
    return {
      distanceM: d1,
      elevationM: obs.elevationM,
      hEff,
      nu: valid ? Math.round(nu * 100) / 100 : null,
      lossDb: valid ? Math.round(knifeEdgeLossDb(nu) * 100) / 100 : 0,
      isMain: idx === d.mainIndex,
    };
  });

  const r2 = (x) => Math.round(x * 100) / 100;
  return {
    mainObstacleIndex: d.mainIndex,
    lossDeygoutDb: r2(d.deygoutDb),
    lossEpsteinPetersonDb: r2(d.epsteinPetersonDb),
    epsteinOverestimationDb: r2(d.epsteinPetersonDb - d.deygoutDb),
    obstacles,
  };
}

// ---------------------------------------------------------------------------
// 4. THEOREM 4: PASSIVE BISTATIC RADAR (PBR) & CRAMÉR-RAO LOWER BOUND (CRLB)
// ---------------------------------------------------------------------------

/**
 * Cramér-Rao Lower Bound on bistatic delay and Doppler for a passive bistatic radar
 * receiving opportunistic DVB-T or FM broadcasts (Kay, Fundamentals of SSP Vol. I, §3.11).
 *
 *   var(τ̂)  ≥ 1 / (8π² · β²_rms · SNR)        β_rms: RMS (Gabor) bandwidth in Hz
 *   var(f̂_d) ≥ 1 / (8π² · T²_rms · SNR)       T_rms: RMS duration in s
 * For a flat (rectangular) spectrum of width B: β_rms = B / (2√3); for a rectangular CIT
 * window of length T: T_rms = T / (2√3). SNR is the post-integration (CAF peak) SNR, i.e.
 * 2E/N₀ — pass the SNR after coherent integration, not the per-sample SNR.
 *
 * Outputs are BISTATIC quantities: σ of the bistatic range sum (R_tx + R_rx) = c·σ_τ and σ of
 * the bistatic range-rate = λ·σ_f. `sigmaVelocityMps` is the latter; it equals the target
 * speed error only in the monostatic limit (β → 0) when divided by 2 (also returned).
 *
 * @param {number} bandwidthHz Signal bandwidth in Hz (e.g. 7.61e6 for DVB-T, 1e5 for FM).
 * @param {number} citSec Coherent integration time in seconds (e.g. 0.25 s).
 * @param {number} snrDb Post-integration SNR at the CAF peak in dB.
 * @param {number} [carrierFreqHz=650e6]
 */
export function computePassiveRadarCrlb(
  bandwidthHz,
  citSec,
  snrDb,
  carrierFreqHz = 650e6
) {
  if (!finite(bandwidthHz, 1e3, 1e9) || !finite(citSec, 0.01, 10) || !finite(snrDb, -50, 100) || !finite(carrierFreqHz, 1e6, 1e11)) {
    throw new TypeError('Invalid bandwidth, integration time, SNR or carrier');
  }
  const snrLinear = Math.pow(10, snrDb / 10);
  const wavelength = SPEED_OF_LIGHT / carrierFreqHz;

  const betaRmsHz = bandwidthHz / (2 * Math.sqrt(3.0));
  const tRmsSec = citSec / (2 * Math.sqrt(3.0));

  const crlbTimeVarianceSec2 = 1.0 / (8.0 * Math.PI * Math.PI * betaRmsHz * betaRmsHz * snrLinear);
  const crlbDopplerVarianceHz2 = 1.0 / (8.0 * Math.PI * Math.PI * tRmsSec * tRmsSec * snrLinear);

  const sigmaRangeM = SPEED_OF_LIGHT * Math.sqrt(crlbTimeVarianceSec2);
  const sigmaVelocityMps = wavelength * Math.sqrt(crlbDopplerVarianceHz2);

  return {
    sigmaRangeM: Math.round(sigmaRangeM * 100) / 100,
    sigmaVelocityMps: Math.round(sigmaVelocityMps * 1000) / 1000,
    sigmaMonostaticSpeedMps: Math.round((sigmaVelocityMps / 2) * 1000) / 1000,
    rangeResolutionM: Math.round((SPEED_OF_LIGHT / bandwidthHz) * 100) / 100,
    crlbTimeVarianceSec2,
    crlbDopplerVarianceHz2,
    cafPeakSnrDb: snrDb,
  };
}

// ---------------------------------------------------------------------------
// 5. THEOREM 5: NEAR-ULTRASOUND ACOUSTIC CAPACITY (18-20 kHz)
// ---------------------------------------------------------------------------

/**
 * Computes acoustic near-ultrasound path budget, SNR and Shannon channel capacity
 * for phone-to-phone air vibration handshakes in disaster noise (85 dBA).
 *
 * @param {number} distanceM Distance between phones in meters (e.g. 5.0m).
 * @param {number} [ambientNoiseDba=85] Ambient emergency noise (rain, wind, sirens).
 * @param {number} [payloadBytes=80] Handshake payload (e.g. 80 bytes).
 * @returns {{
 *   receivedSplDb: number,
 *   hfNoiseFloorSplDb: number,
 *   snrDb: number,
 *   shannonCapacityBps: number,
 *   transmissionTimeSec: number,
 *   packetErrorRate: number
 * }}
 */
export function computeAcousticNearUltrasoundBudget(
  distanceM,
  ambientNoiseDba = 85,
  payloadBytes = 80
) {
  if (!finite(distanceM, 0.1, 50)) throw new TypeError('distanceM must be between 0.1m and 50m');

  // Speaker source level at r0 = 0.1m: ~82 dB SPL
  const sourceSpl01m = 82.0;

  // Atmospheric absorption at 19 kHz, 20°C, 60% RH: ~0.58 dB/m (ISO 9613-1)
  const alphaAtm = 0.58;

  // Spherical divergence + molecular absorption
  const divergenceLoss = 20.0 * Math.log10(Math.max(1.0, distanceM / 0.1));
  const absorptionLoss = alphaAtm * distanceM;
  const receivedSplDb = sourceSpl01m - divergenceLoss - absorptionLoss;

  // Ambient disaster noise decays by ~42 dB in 18-20 kHz band due to 1/f^2 PSD decay
  const hfNoiseFloorSplDb = Math.max(20.0, ambientNoiseDba - 42.0);

  const snrDb = receivedSplDb - hfNoiseFloorSplDb;
  const snrLinear = Math.pow(10, snrDb / 10);

  // Bandwidth B = 2000 Hz (18000 to 20000 Hz)
  const B = 2000.0;
  const shannonCapacityBps = B * Math.log2(1.0 + Math.max(0.01, snrLinear));

  // Physical layer: non-coherent orthogonal 16-FSK. Orthogonality needs tone spacing ≥ Rs,
  // so 16 tones in 2 kHz → Rs = 125 baud → 500 bit/s raw (4 bit/symbol).
  const M = 16;
  const symbolRate = B / M; // 125 baud
  const rawBps = symbolRate * Math.log2(M); // 500 bit/s
  const esN0 = snrLinear * (B / symbolRate); // in-band SNR → Es/N0
  const symbolErrorRate = mfskNoncoherentSer(M, esN0);

  // RS(104, 80) over GF(256): each RS symbol (8 bits) = 2 FSK symbols; corrects t = 12 byte errors.
  const encodedBytes = payloadBytes + 24;
  const byteErrorRate = 1 - (1 - symbolErrorRate) ** 2;
  const transmissionTimeSec = (encodedBytes * 8.0) / rawBps;
  const packetErrorRate = rsBlockErrorRate(encodedBytes, 12, byteErrorRate);

  return {
    receivedSplDb: Math.round(receivedSplDb * 100) / 100,
    hfNoiseFloorSplDb: Math.round(hfNoiseFloorSplDb * 100) / 100,
    snrDb: Math.round(snrDb * 100) / 100,
    shannonCapacityBps: Math.round(shannonCapacityBps),
    transmissionTimeSec: Math.round(transmissionTimeSec * 100) / 100,
    symbolErrorRate,
    packetErrorRate,
    assumptions: 'AWGN in-band; noise SPL = ambient dBA − 42 dB (assumed HF roll-off, to be measured); speaker 82 dB SPL @ 0.1 m (assumed); no multipath/Doppler.',
  };
}

/** Non-coherent orthogonal M-FSK symbol error rate in AWGN (Proakis, Digital Communications, eq. 4.5-43). */
export function mfskNoncoherentSer(M, esN0) {
  let p = 0;
  let binom = 1;
  for (let k = 1; k < M; k++) {
    binom = (binom * (M - k)) / k; // C(M-1, k)
    p += ((k % 2 ? 1 : -1) * binom / (k + 1)) * Math.exp((-k / (k + 1)) * esN0);
  }
  return Math.min(1, Math.max(0, p));
}

/** Block error probability of a t-error-correcting code of length n with i.i.d. symbol error rate p. */
export function rsBlockErrorRate(n, t, p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // P(fail) = Σ_{i=t+1..n} C(n,i) p^i (1-p)^{n-i}, computed in log space for stability.
  const lnFact = (x) => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s; };
  const lnN = lnFact(n);
  let sum = 0;
  for (let i = t + 1; i <= n; i++) {
    sum += Math.exp(lnN - lnFact(i) - lnFact(n - i) + i * Math.log(p) + (n - i) * Math.log1p(-p));
  }
  return Math.min(1, sum);
}
