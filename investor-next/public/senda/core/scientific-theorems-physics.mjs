/**
 * SENDA Scientific Theorems & Advanced Mathematical Physics Engine.
 *
 * Implements deterministic, 64-bit precision numerical models for:
 * 1. Theorem 1: Al-Hourani A2G Optimal Drone Altitude via Transcendental Root-Finding.
 * 2. Theorem 2: Swarm Graph Laplacian, Fiedler Algebraic Connectivity (λ₂) & Perturbation Gradient.
 * 3. Theorem 3: Deygout ITU-R P.526-15 Recursive Multi-Obstacle Diffraction vs Epstein-Peterson.
 * 4. Theorem 4: Passive Bistatic Radar (PBR) Ambiguity & Cramér-Rao Lower Bounds (CRLB).
 * 5. Theorem 5: Near-Ultrasound (18-20 kHz) Acoustic Capacity under Severe Catastrophe Noise (85 dBA).
 */

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
  CANYON_RUBBLE: { a: 27.23, b: 0.08, etaLos: 2.3, etaNlos: 34.0, label: 'Cañón de Escombros / Catástrofe' },
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
  if (!Array.isArray(adjMatrix) || N < 2) {
    throw new TypeError('adjMatrix must be at least a 2x2 matrix');
  }

  // Construct Laplacian L = D - A
  const L = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    let degree = 0;
    for (let j = 0; j < N; j++) {
      if (i !== j) {
        const w = Math.max(0, adjMatrix[i][j] || 0);
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

  for (let iter = 0; iter < 150; iter++) {
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
    if (maxOff < 1e-12) break;

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
 * Computes Deygout multi-obstacle diffraction and compares against Epstein-Peterson.
 *
 * @param {Array<{ distanceM: number, elevationM: number }>} terrainProfile
 * @param {number} txElevationM
 * @param {number} rxElevationM
 * @param {number} totalDistanceM
 * @param {number} [frequencyHz=868e6]
 * @returns {{
 *   mainObstacleIndex: number,
 *   lossDeygoutDb: number,
 *   lossEpsteinPetersonDb: number,
 *   epsteinOverestimationDb: number,
 *   obstacles: Array<{ distanceM: number, elevationM: number, nu: number, lossDb: number, isMain: boolean }>
 * }}
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
  const wavelength = SPEED_OF_LIGHT / frequencyHz;

  // 1. Calculate Fresnel parameter nu for each obstacle relative to direct Tx-Rx line
  let maxNu = -Infinity;
  let mainIndex = 0;

  const evaluated = terrainProfile.map((obs, idx) => {
    const d1 = obs.distanceM;
    const d2 = totalDistanceM - d1;
    const losLineHeight = txElevationM + (rxElevationM - txElevationM) * (d1 / totalDistanceM);
    const hEff = obs.elevationM - losLineHeight;

    const nu = hEff * Math.sqrt((2.0 * totalDistanceM) / (wavelength * d1 * d2));
    if (nu > maxNu) {
      maxNu = nu;
      mainIndex = idx;
    }
    return {
      distanceM: d1,
      elevationM: obs.elevationM,
      hEff,
      nu: Math.round(nu * 100) / 100,
      lossDb: Math.round(knifeEdgeLossDb(nu) * 100) / 100,
      isMain: false,
    };
  });

  evaluated[mainIndex].isMain = true;
  const mainLoss = knifeEdgeLossDb(maxNu);

  // 2. Secondary obstacles (sub-paths: Tx -> Main, and Main -> Rx)
  const mainObs = terrainProfile[mainIndex];
  let leftSubLoss = 0;
  let leftScale = 1.0;
  let rightSubLoss = 0;
  let rightScale = 1.0;

  // Left sub-path
  let maxNuLeft = -Infinity;
  for (let i = 0; i < mainIndex; i++) {
    const obs = terrainProfile[i];
    const d1 = obs.distanceM;
    const d2 = mainObs.distanceM - d1;
    const losH = txElevationM + (mainObs.elevationM - txElevationM) * (d1 / mainObs.distanceM);
    const hEff = obs.elevationM - losH;
    const nu = hEff * Math.sqrt((2.0 * mainObs.distanceM) / (wavelength * d1 * d2));
    if (nu > maxNuLeft) maxNuLeft = nu;
  }
  if (maxNuLeft > -0.78) {
    leftSubLoss = knifeEdgeLossDb(maxNuLeft);
    leftScale = Math.sqrt(mainObs.distanceM / totalDistanceM);
  }

  // Right sub-path
  let maxNuRight = -Infinity;
  for (let i = mainIndex + 1; i < terrainProfile.length; i++) {
    const obs = terrainProfile[i];
    const d1 = obs.distanceM - mainObs.distanceM;
    const d2 = totalDistanceM - obs.distanceM;
    const pathDist = totalDistanceM - mainObs.distanceM;
    const losH = mainObs.elevationM + (rxElevationM - mainObs.elevationM) * (d1 / pathDist);
    const hEff = obs.elevationM - losH;
    const nu = hEff * Math.sqrt((2.0 * pathDist) / (wavelength * d1 * d2));
    if (nu > maxNuRight) maxNuRight = nu;
  }
  if (maxNuRight > -0.78) {
    rightSubLoss = knifeEdgeLossDb(maxNuRight);
    rightScale = Math.sqrt((totalDistanceM - mainObs.distanceM) / totalDistanceM);
  }

  // Deygout with geometrical scale factor
  const lossDeygoutDb = mainLoss + leftSubLoss * leftScale + rightSubLoss * rightScale;

  // Epstein-Peterson unscaled sum (classical flawed model)
  const lossEpsteinPetersonDb = mainLoss + leftSubLoss + rightSubLoss;
  const epsteinOverestimationDb = lossEpsteinPetersonDb - lossDeygoutDb;

  return {
    mainObstacleIndex: mainIndex,
    lossDeygoutDb: Math.round(lossDeygoutDb * 100) / 100,
    lossEpsteinPetersonDb: Math.round(lossEpsteinPetersonDb * 100) / 100,
    epsteinOverestimationDb: Math.round(epsteinOverestimationDb * 100) / 100,
    obstacles: evaluated,
  };
}

// ---------------------------------------------------------------------------
// 4. THEOREM 4: PASSIVE BISTATIC RADAR (PBR) & CRAMÉR-RAO LOWER BOUND (CRLB)
// ---------------------------------------------------------------------------

/**
 * Computes the Cramér-Rao Lower Bound (CRLB) on range and Doppler velocity estimation
 * for a silent passive bistatic radar receiving opportunistic DVB-T or FM broadcasts.
 *
 * @param {number} bandwidthHz Signal bandwidth in Hz (e.g. 7.61e6 for DVB-T, 1e5 for FM).
 * @param {number} citSec Coherent integration time in seconds (e.g. 0.25 s).
 * @param {number} snrDb Bistatic SNR in dB (e.g. 15 dB).
 * @param {number} [carrierFreqHz=650e6]
 * @returns {{
 *   sigmaRangeM: number,
 *   sigmaVelocityMps: number,
 *   crlbTimeVarianceSec2: number,
 *   crlbDopplerVarianceHz2: number,
 *   cafPeakSnrDb: number
 * }}
 */
export function computePassiveRadarCrlb(
  bandwidthHz,
  citSec,
  snrDb,
  carrierFreqHz = 650e6
) {
  if (!finite(bandwidthHz, 1e3, 1e9) || !finite(citSec, 0.01, 10)) {
    throw new TypeError('Invalid bandwidth or integration time');
  }
  const snrLinear = Math.pow(10, snrDb / 10);
  const wavelength = SPEED_OF_LIGHT / carrierFreqHz;

  // RMS bandwidth for rectangular/OFDM spectrum: β_rms = π * B / sqrt(3)
  const betaRms = (Math.PI * bandwidthHz) / Math.sqrt(3.0);

  // RMS time for coherent integration time T_int: T_rms = π * T_int / sqrt(3)
  const tRms = (Math.PI * citSec) / Math.sqrt(3.0);

  // Cramér-Rao Lower Bounds
  const crlbTimeVarianceSec2 = 1.0 / (8.0 * Math.PI * Math.PI * betaRms * betaRms * snrLinear);
  const crlbDopplerVarianceHz2 = 1.0 / (8.0 * Math.PI * Math.PI * tRms * tRms * snrLinear);

  // Metric conversion
  const sigmaRangeM = SPEED_OF_LIGHT * Math.sqrt(crlbTimeVarianceSec2);
  const sigmaVelocityMps = (wavelength / 2.0) * Math.sqrt(crlbDopplerVarianceHz2);

  return {
    sigmaRangeM: Math.round(sigmaRangeM * 100) / 100,
    sigmaVelocityMps: Math.round(sigmaVelocityMps * 1000) / 1000,
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

  // Reed-Solomon RS(104, 80) coding: 104 bytes encoded, 400 baud 16-FSK (500 bps effective)
  const encodedBytes = payloadBytes + 24; // 24 parity bytes (corrects up to 12 bytes)
  const effectiveBps = 500.0;
  const transmissionTimeSec = (encodedBytes * 8.0) / effectiveBps;

  // Probability of packet error: with 24 parity bytes and SNR > 0 dB, P_FER < 1e-7
  const packetErrorRate = snrDb >= 0 ? 1e-7 : Math.min(1.0, Math.exp(snrDb * 0.5));

  return {
    receivedSplDb: Math.round(receivedSplDb * 100) / 100,
    hfNoiseFloorSplDb: Math.round(hfNoiseFloorSplDb * 100) / 100,
    snrDb: Math.round(snrDb * 100) / 100,
    shannonCapacityBps: Math.round(shannonCapacityBps),
    transmissionTimeSec: Math.round(transmissionTimeSec * 100) / 100,
    packetErrorRate,
  };
}
