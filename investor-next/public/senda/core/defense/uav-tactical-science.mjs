/**
 * SENDA UAV Tactical Science, Air-to-Ground (A2G) 3D Propagation & Swarm Topographic Mapping Engine.
 *
 * Provides analytical models and scientific calibration for:
 * 1. Al-Hourani / ITU-R P.1410 Probabilistic 3D Air-to-Ground (A2G) Channel Modeling.
 * 2. Optimal Drone Hovering Altitude & Maximum Ground Coverage Footprint.
 * 3. UAV Swarm Graph Laplacian & Algebraic Connectivity (Fiedler Eigenvalue λ₂).
 * 4. GPS-Denied Cooperative RF Trilateration & Inertial Drift Reconstruction.
 * 5. Aerial Photogrammetric Ground Sampling Distance (GSD) & 3D Dem Mapping Overlap.
 * 6. Electronic Warfare (EW) Jamming Margin & Anti-Interference Processing Gain.
 *
 * Applicable to defense reconnaissance, UME disaster inspection, and conflict-zone emergency corridors.
 */

const SPEED_OF_LIGHT = 299792458; // m/s

function finite(n, min = -Infinity, max = Infinity) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

// Environment Morphology Parameters for A2G Propagation (Al-Hourani et al.)
export const A2G_ENVIRONMENTS = Object.freeze({
  SUBURBAN: { a: 4.88, b: 0.43, etaLosDb: 0.1, etaNlosDb: 21.0, label: 'Suburbano / Campo Abierto' },
  URBAN: { a: 9.61, b: 0.16, etaLosDb: 1.0, etaNlosDb: 20.0, label: 'Urbano Estándar' },
  DENSE_URBAN: { a: 12.08, b: 0.11, etaLosDb: 1.6, etaNlosDb: 23.0, label: 'Urbano Denso / Edificios Altos' },
  CANYON_RUBBLE: { a: 27.23, b: 0.08, etaLosDb: 2.3, etaNlosDb: 34.0, label: 'Zona Catástrofe / Cañón de Escombros' },
});

// ---------------------------------------------------------------------------
// 1. PROBABILISTIC AIR-TO-GROUND (A2G) 3D PROPAGATION MODEL
// ---------------------------------------------------------------------------

/**
 * Computes elevation angle and Line-of-Sight (LoS) probability between a UAV
 * and a ground terminal over terrain clutter.
 *
 * P_LoS(θ) = 1 / (1 + a * exp(-b * (θ - a)))
 *
 * @param {number} uavAltitudeM Altitude of UAV above ground level (AGL) in meters.
 * @param {number} groundDistanceM Horizontal distance on ground in meters.
 * @param {keyof typeof A2G_ENVIRONMENTS} [envType='URBAN'] Environment clutter type.
 * @returns {{ elevationDeg: number, pLos: number, pNlos: number, 3dDistanceM: number }}
 */
export function computeAirToGroundLoSProbability(uavAltitudeM, groundDistanceM, envType = 'URBAN') {
  if (!finite(uavAltitudeM, 1, 50000) || !finite(groundDistanceM, 0, 100000)) {
    throw new TypeError('Invalid altitude (1-50000m) or ground distance (0-100km)');
  }
  const env = A2G_ENVIRONMENTS[envType] || A2G_ENVIRONMENTS.URBAN;

  const elevationRad = groundDistanceM === 0 ? Math.PI / 2 : Math.atan(uavAltitudeM / groundDistanceM);
  const elevationDeg = (elevationRad * 180) / Math.PI;

  const d3d = Math.sqrt(uavAltitudeM * uavAltitudeM + groundDistanceM * groundDistanceM);

  // Al-Hourani sigmoid model for LoS probability
  const exponent = -env.b * (elevationDeg - env.a);
  const pLos = Math.min(1.0, Math.max(0.0, 1.0 / (1.0 + env.a * Math.exp(exponent))));
  const pNlos = 1.0 - pLos;

  return {
    elevationDeg: Math.round(elevationDeg * 100) / 100,
    pLos: Math.round(pLos * 10000) / 10000,
    pNlos: Math.round(pNlos * 10000) / 10000,
    '3dDistanceM': Math.round(d3d * 10) / 10,
  };
}

/**
 * Computes total expected A2G path loss in dB including free-space and clutter losses.
 *
 * PL(θ, d) = FSPL(d) + P_LoS(θ) * η_LoS + (1 - P_LoS(θ)) * η_NLoS
 *
 * @param {number} uavAltitudeM Altitude AGL in meters.
 * @param {number} groundDistanceM Horizontal distance in meters.
 * @param {number} frequencyHz Carrier frequency in Hz (e.g. 868e6, 2.4e9, 5.8e9).
 * @param {keyof typeof A2G_ENVIRONMENTS} [envType='URBAN'] Environment type.
 * @returns {{ totalPathLossDb: number, fsplDb: number, excessLossDb: number, pLos: number }}
 */
export function computeAirToGroundPathLoss(uavAltitudeM, groundDistanceM, frequencyHz, envType = 'URBAN') {
  if (!finite(frequencyHz, 1e6, 1e11)) throw new TypeError('Invalid frequency');
  const env = A2G_ENVIRONMENTS[envType] || A2G_ENVIRONMENTS.URBAN;
  const los = computeAirToGroundLoSProbability(uavAltitudeM, groundDistanceM, envType);

  const d = los['3dDistanceM'];
  const wavelength = SPEED_OF_LIGHT / frequencyHz;
  const fsplDb = 20 * Math.log10((4 * Math.PI * Math.max(1, d)) / wavelength);

  const excessLossDb = los.pLos * env.etaLosDb + los.pNlos * env.etaNlosDb;
  const totalPathLossDb = fsplDb + excessLossDb;

  return {
    totalPathLossDb: Math.round(totalPathLossDb * 100) / 100,
    fsplDb: Math.round(fsplDb * 100) / 100,
    excessLossDb: Math.round(excessLossDb * 100) / 100,
    pLos: los.pLos,
  };
}

/**
 * Finds the theoretical optimal elevation angle theta_opt in degrees that maximizes
 * LAP coverage radius per Al-Hourani, Kandeepan & Lardner (IEEE WCL 2014) Eq. (9).
 *
 * (pi / (9 * ln 10)) * tan(theta_opt) = (dPLoS/dtheta) * (eta_NLoS - eta_LoS)
 *
 * @param {object} env Clutter environment parameters.
 * @returns {number} Optimal elevation angle in degrees.
 */
export function computeOptimalElevationAngleDeg(env) {
  let low = 0.5;
  let high = 89.5;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const term1 = (Math.PI / (9 * Math.log(10))) * Math.tan((mid * Math.PI) / 180);
    const expTerm = Math.exp(-env.b * (mid - env.a));
    const dP = (env.a * env.b * expTerm) / Math.pow(1 + env.a * expTerm, 2);
    const term2 = dP * (env.etaNlosDb - env.etaLosDb);
    if (term1 - term2 < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.round(((low + high) / 2) * 100) / 100;
}

/**
 * Determines the optimal UAV hovering altitude (h_opt) that maximizes the ground coverage radius
 * for a maximum allowable link path loss (e.g. 105 dB for LoRa, 80 dB for Wi-Fi), subject to
 * tactical emergency airspace operational ceiling constraints (default 300 m AGL is a configurable planning value: EASA 'open' category is limited to 120 m;
 * higher operations need a 'specific'-category authorisation or state/emergency exemption).
 *
 * Grounded in Al-Hourani, Kandeepan & Lardner (IEEE WCL 2014) "Optimal LAP Altitude for Maximum Coverage".
 *
 * @param {number} maxAllowablePathLossDb Maximum acceptable path loss before link failure.
 * @param {number} frequencyHz Carrier frequency in Hz.
 * @param {keyof typeof A2G_ENVIRONMENTS} [envType='URBAN'] Environment clutter type.
 * @param {number} [operationalCeilingM=300] Tactical operational altitude ceiling in meters AGL.
 * @returns {{ optimalAltitudeM: number, maxCoverageRadiusM: number, coverageAreaKm2: number, optimalElevationDeg: number, operationalCeilingM: number }}
 */
export function calculateOptimalUavAltitude(maxAllowablePathLossDb, frequencyHz, envType = 'URBAN', operationalCeilingM = 300) {
  if (!finite(maxAllowablePathLossDb, 40, 160) || !finite(frequencyHz, 1e6, 1e11)) {
    throw new TypeError('Invalid path loss budget or frequency');
  }
  const ceiling = finite(operationalCeilingM, 30, 5000) ? operationalCeilingM : 300;
  const env = A2G_ENVIRONMENTS[envType] || A2G_ENVIRONMENTS.URBAN;
  const optimalElevationDeg = computeOptimalElevationAngleDeg(env);

  // Numerical search over altitude (30m up to operationalCeilingM) to find maximum ground footprint
  let bestRadius = 0;
  let bestAltitude = Math.min(120, ceiling);

  const stepSize = Math.max(5, Math.round(ceiling / 60));
  for (let alt = 30; alt <= ceiling; alt += stepSize) {
    // Binary search for maximum radius at this altitude
    let lowR = 10;
    let highR = 25000;
    let maxRAtAlt = 0;

    for (let step = 0; step < 16; step++) {
      const midR = (lowR + highR) / 2;
      const pl = computeAirToGroundPathLoss(alt, midR, frequencyHz, envType);
      if (pl.totalPathLossDb <= maxAllowablePathLossDb) {
        maxRAtAlt = midR;
        lowR = midR;
      } else {
        highR = midR;
      }
    }

    if (maxRAtAlt > bestRadius) {
      bestRadius = maxRAtAlt;
      bestAltitude = alt;
    }
  }

  const coverageAreaKm2 = (Math.PI * bestRadius * bestRadius) / 1e6;

  return {
    optimalAltitudeM: Math.round(bestAltitude),
    maxCoverageRadiusM: Math.round(bestRadius),
    coverageAreaKm2: Math.round(coverageAreaKm2 * 100) / 100,
    optimalElevationDeg,
    operationalCeilingM: ceiling,
  };
}

// ---------------------------------------------------------------------------
// 2. UAV SWARM TOPOLOGY & ALGEBRAIC CONNECTIVITY (FIEDLER EIGENVALUE λ₂)
// ---------------------------------------------------------------------------

/**
 * Computes the Euclidean distance between two 3D positions { x, y, z }.
 */
function dist3d(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Power iteration / Deflation algorithm to compute the second smallest eigenvalue
 * (Fiedler eigenvalue λ₂) of the Swarm Graph Laplacian matrix L = D - A.
 *
 * If λ₂ > 0: Swarm graph is mathematically guaranteed to be strictly connected.
 * Larger λ₂: Faster consensus, higher resilience to drone dropouts and jammer partitioning.
 *
 * @param {Array<{ id: string, x: number, y: number, z?: number }>} drones Array of 3D drone positions.
 * @param {number} interDroneCommRangeM Maximum RF communication range between drones in meters.
 * @returns {{ algebraicConnectivity: number, isSwarmConnected: boolean, degreeMin: number, degreeMean: number, totalLinks: number }}
 */
export function computeSwarmAlgebraicConnectivity(drones, interDroneCommRangeM) {
  if (!Array.isArray(drones) || drones.length < 2 || !finite(interDroneCommRangeM, 1)) {
    return { algebraicConnectivity: 0, isSwarmConnected: false, degreeMin: 0, degreeMean: 0, totalLinks: 0 };
  }

  const n = drones.length;
  // Build Adjacency Matrix A and Degree Matrix D
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const degrees = new Float64Array(n);
  let totalLinks = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dist3d(drones[i], drones[j]);
      if (d <= interDroneCommRangeM) {
        A[i][j] = 1;
        A[j][i] = 1;
        degrees[i]++;
        degrees[j]++;
        totalLinks++;
      }
    }
  }

  let degreeMin = Infinity;
  let degreeSum = 0;
  for (let i = 0; i < n; i++) {
    if (degrees[i] < degreeMin) degreeMin = degrees[i];
    degreeSum += degrees[i];
  }
  const degreeMean = degreeSum / n;

  // If any node is isolated, algebraic connectivity is exactly 0
  if (degreeMin === 0) {
    return { algebraicConnectivity: 0, isSwarmConnected: false, degreeMin, degreeMean: Math.round(degreeMean * 100) / 100, totalLinks };
  }

  // Construct Laplacian Matrix L = D - A
  const L = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      row[j] = (i === j) ? degrees[i] : -A[i][j];
    }
    return row;
  });

  // Estimate maximum eigenvalue λ_max of L via Gershgorin circle theorem / power iteration
  const lambdaMaxEstimate = 2 * Math.max(...degrees);
  // Shifted matrix M = λ_max * I - L
  // The largest eigenvalue of M corresponds to λ_max - λ_min(L) = λ_max - 0 = λ_max (eigenvector 1/√N)
  // The second largest eigenvalue of M corresponds to λ_max - λ_2(L)
  const M = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      row[j] = (i === j ? lambdaMaxEstimate : 0) - L[i][j];
    }
    return row;
  });

  // Trivial eigenvector v1 = 1 / sqrt(n)
  const v1 = new Float64Array(n).fill(1 / Math.sqrt(n));

  // Initialize random vector orthogonal to v1
  let v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.sin(i * 1.5 + 0.3);
  // Deflate: v = v - (v · v1) * v1
  let dotV1 = 0;
  for (let i = 0; i < n; i++) dotV1 += v[i] * v1[i];
  for (let i = 0; i < n; i++) v[i] -= dotV1 * v1[i];

  // Power iterations to find second largest eigenvalue of M
  let mu2 = 0;
  for (let iter = 0; iter < 50; iter++) {
    const nextV = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += M[i][j] * v[j];
      nextV[i] = sum;
    }
    // Re-orthogonalize against v1
    let d1 = 0;
    for (let i = 0; i < n; i++) d1 += nextV[i] * v1[i];
    for (let i = 0; i < n; i++) nextV[i] -= d1 * v1[i];

    // Normalize
    let norm = 0;
    for (let i = 0; i < n; i++) norm += nextV[i] * nextV[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-12) { mu2 = 0; break; }
    for (let i = 0; i < n; i++) v[i] = nextV[i] / norm;

    // Rayleigh quotient
    let rayleigh = 0;
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) rowSum += M[i][j] * v[j];
      rayleigh += v[i] * rowSum;
    }
    mu2 = rayleigh;
  }

  // λ₂(L) = λ_max - μ₂
  const lambda2 = Math.max(0, lambdaMaxEstimate - mu2);
  const isSwarmConnected = lambda2 > 0.005;

  return {
    algebraicConnectivity: Math.round(lambda2 * 1000) / 1000,
    isSwarmConnected,
    degreeMin,
    degreeMean: Math.round(degreeMean * 100) / 100,
    totalLinks,
  };
}

// ---------------------------------------------------------------------------
// 3. TOPOGRAPHIC MAPPING & AERIAL PHOTOGRAMMETRY RESOLUTION
// ---------------------------------------------------------------------------

/**
 * Calculates Ground Sampling Distance (GSD), ground footprint, and Structure-from-Motion
 * overlap parameters for high-resolution post-disaster 3D DEM reconstruction.
 *
 * GSD = (h * S_w) / (f * I_w)
 *
 * @param {object} params
 * @param {number} params.flightAltitudeM Flight altitude AGL in meters.
 * @param {number} params.focalLengthMm Camera optical focal length in mm (e.g. 24mm, 35mm).
 * @param {number} params.sensorWidthMm Camera sensor physical width in mm (e.g. 13.2mm 1-inch, 35.9mm Full-frame).
 * @param {number} params.imageWidthPx Horizontal image resolution in pixels (e.g. 4000, 5472, 8192).
 * @param {number} params.forwardOverlapRatio Desired forward overlap between photos (e.g. 0.80 = 80%).
 * @param {number} params.sideOverlapRatio Desired side overlap between flight lines (e.g. 0.70 = 70%).
 * @param {number} [params.flightSpeedMs=12] Drone ground speed in m/s.
 * @returns {{ gsdCmPerPx: number, footprintWidthM: number, photoIntervalSeconds: number, flightLineSpacingM: number, isSfmReconstructionFeasible: boolean }}
 */
export function computeAerialPhotogrammetryParams({
  flightAltitudeM,
  focalLengthMm,
  sensorWidthMm,
  imageWidthPx,
  forwardOverlapRatio = 0.75,
  sideOverlapRatio = 0.65,
  flightSpeedMs = 12,
}) {
  if (!finite(flightAltitudeM, 5, 5000) || !finite(focalLengthMm, 2, 500) ||
      !finite(sensorWidthMm, 2, 100) || !finite(imageWidthPx, 100, 50000)) {
    throw new TypeError('Invalid photogrammetric optical parameters');
  }

  // GSD in cm/pixel
  const gsdM = (flightAltitudeM * (sensorWidthMm / 1000)) / ((focalLengthMm / 1000) * imageWidthPx);
  const gsdCmPerPx = Math.round(gsdM * 100 * 100) / 100;

  // Single photo ground footprint width in meters
  const footprintWidthM = (flightAltitudeM * sensorWidthMm) / focalLengthMm;

  // Distance between consecutive photo triggers
  const forwardStepM = footprintWidthM * (1.0 - forwardOverlapRatio);
  const photoIntervalSeconds = Math.max(0.5, Math.round((forwardStepM / Math.max(0.1, flightSpeedMs)) * 10) / 10);

  // Lateral distance between parallel flight lines
  const flightLineSpacingM = Math.round(footprintWidthM * (1.0 - sideOverlapRatio) * 10) / 10;

  // For high-density 3D DEM reconstruction, forward overlap must be >= 70% and side overlap >= 60%
  const isSfmReconstructionFeasible = forwardOverlapRatio >= 0.70 && sideOverlapRatio >= 0.60 && gsdCmPerPx <= 10.0;

  return {
    gsdCmPerPx,
    footprintWidthM: Math.round(footprintWidthM * 10) / 10,
    photoIntervalSeconds,
    flightLineSpacingM,
    isSfmReconstructionFeasible,
  };
}

// ---------------------------------------------------------------------------
// 4. ELECTRONIC WARFARE (EW) & ANTI-JAMMING LINK MARGIN
// ---------------------------------------------------------------------------

/**
 * Computes spread spectrum processing gain and anti-jamming tolerance margin
 * under adversarial electronic warfare interference or intense spectrum congestion.
 *
 * Processing Gain: G_p = 10 * log10(RF_Bandwidth / Data_Rate)
 * Jamming Margin: M_j = G_p - (Eb/N0)_req - System_Losses
 *
 * @param {number} rfBandwidthHz Spread spectrum channel bandwidth (e.g. 125 kHz LoRa, 20 MHz DSSS, 80 MHz FHSS).
 * @param {number} dataRateBps User payload data rate in bits/second (e.g. 300 bps SOS, 50 kbps telemetry).
 * @param {number} [requiredEbN0Db=6.0] Required energy per bit over noise spectral density in dB.
 * @param {number} [systemLossesDb=2.0] System implementation and filter losses in dB.
 * @returns {{ processingGainDb: number, jammingMarginDb: number, maxJammerToSignalRatioDb: number, isResilientUnderTacticalJamming: boolean }}
 */
export function computeAntiJammingMargin(rfBandwidthHz, dataRateBps, requiredEbN0Db = 6.0, systemLossesDb = 2.0) {
  if (!finite(rfBandwidthHz, 1e3) || !finite(dataRateBps, 1) || rfBandwidthHz <= dataRateBps) {
    throw new TypeError('rfBandwidthHz must be strictly greater than dataRateBps');
  }

  const processingGainDb = Math.round(10 * Math.log10(rfBandwidthHz / dataRateBps) * 10) / 10;
  const jammingMarginDb = Math.round((processingGainDb - requiredEbN0Db - systemLossesDb) * 10) / 10;

  // Under continuous wideband noise jamming, positive margin means signal can be recovered
  // even if jammer is M_j dB stronger than the desired transmitter at the receiver antenna
  const isResilientUnderTacticalJamming = jammingMarginDb >= 15.0;

  return {
    processingGainDb,
    jammingMarginDb,
    maxJammerToSignalRatioDb: jammingMarginDb,
    isResilientUnderTacticalJamming,
  };
}
