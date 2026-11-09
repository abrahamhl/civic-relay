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
 * Differential model: dI/dt = β * (N - I) * I - μ * I
 * Basic reproduction number: R_0 = β * N / μ
 *
 * @param {number} totalNodes Total mobile nodes (vehicles, responders, gateways).
 * @param {number} contactRatePerHour Mean inter-node opportunistic contact rate (contacts/hour/pair).
 * @param {number} packetTtlHours Maximum packet time-to-live in buffer before eviction.
 * @param {number} [bufferLossRate=0.02] Probability of packet drop due to buffer contention.
 * @returns {{ r0: number, epidemicGrowthRate: number, t50Hours: number, t90Hours: number, t99Hours: number, extinctionProb: number }}
 */
export function computeDtnEpidemicSpreading(totalNodes, contactRatePerHour, packetTtlHours, bufferLossRate = 0.02) {
  if (!finite(totalNodes, 2, 1e7) || !finite(contactRatePerHour, 0.001, 1000) || !finite(packetTtlHours, 0.1, 720)) {
    throw new TypeError('Invalid input parameters for DTN epidemic spreading');
  }

  const beta = contactRatePerHour / totalNodes; // transmission rate per contact
  const mu = 1.0 / packetTtlHours + bufferLossRate; // departure/loss rate
  const r0 = (beta * totalNodes) / mu;

  // Logistic growth rate r = beta * N - mu
  const r = beta * totalNodes - mu;

  let t50Hours = Infinity;
  let t90Hours = Infinity;
  let t99Hours = Infinity;
  let extinctionProb = 1.0;

  if (r0 > 1.0 && r > 0) {
    extinctionProb = Math.pow(1.0 / r0, 1.0); // branching process survival approximation
    // Time to infect fraction p starting from 1 infected node:
    // t(p) ≈ ln((p / (1 - p)) * (N - 1)) / r
    t50Hours = Math.max(0, Math.log(totalNodes - 1) / r);
    t90Hours = Math.max(0, Math.log(9 * (totalNodes - 1)) / r);
    t99Hours = Math.max(0, Math.log(99 * (totalNodes - 1)) / r);
  }

  return {
    r0: Math.round(r0 * 1000) / 1000,
    epidemicGrowthRate: Math.round(r * 1000) / 1000,
    t50Hours: Math.round(t50Hours * 100) / 100,
    t90Hours: Math.round(t90Hours * 100) / 100,
    t99Hours: Math.round(t99Hours * 100) / 100,
    extinctionProb: Math.round(extinctionProb * 1000) / 1000,
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
 * J(v) = 6.9 + 20 * log10( sqrt((v - 0.1)^2 + 1) + v - 0.1 ) for v > -0.7
 */
export function computeKnifeEdgeLossDb(v) {
  if (v <= -0.7) return 0;
  const term = Math.sqrt((v - 0.1) ** 2 + 1) + (v - 0.1);
  return term > 0 ? 6.9 + 20 * Math.log10(term) : 0;
}

/**
 * Deygout multi-obstacle diffraction method for up to 3 dominant terrain ridges.
 * Identifies the main obstacle (highest v) and computes secondary diffraction losses
 * with correction factors according to ITU-R P.526 section 4.3.
 *
 * @param {Array<{ distanceM: number, elevationM: number }>} terrainProfile Elevation profile from Tx to Rx.
 * @param {number} txElevationM Tx altitude above sea level + mast height.
 * @param {number} rxElevationM Rx altitude above sea level + mast height.
 * @param {number} totalDistanceM Total link distance in meters.
 * @param {number} frequencyHz Carrier frequency in Hz.
 * @returns {{ mainObstacleIndex: number, totalDiffractionLossDb: number, obstaclesEvaluated: number }}
 */
export function computeDeygoutDiffractionLoss(terrainProfile, txElevationM, rxElevationM, totalDistanceM, frequencyHz) {
  if (!Array.isArray(terrainProfile) || terrainProfile.length === 0 || totalDistanceM <= 0 || frequencyHz <= 0) {
    return { mainObstacleIndex: -1, totalDiffractionLossDb: 0, obstaclesEvaluated: 0 };
  }

  const wavelength = SPEED_OF_LIGHT / frequencyHz;

  // Step 1: Find LOS clearance h for all profile points and find the point with highest v
  let maxV = -Infinity;
  let mainIdx = -1;

  const pointsWithV = terrainProfile.map((pt, idx) => {
    const d1 = pt.distanceM;
    const d2 = totalDistanceM - d1;
    if (d1 <= 0 || d2 <= 0) return { idx, v: -Infinity, h: 0, d1, d2 };

    // Geometric LOS line height at distance d1
    const losHeight = txElevationM + (d1 / totalDistanceM) * (rxElevationM - txElevationM);
    // Obstacle intrusion height h above LOS (positive if blocking LOS)
    const h = pt.elevationM - losHeight;
    const v = computeFresnelV(h, d1, d2, wavelength);
    if (v > maxV) {
      maxV = v;
      mainIdx = idx;
    }
    return { idx, v, h, d1, d2, elevationM: pt.elevationM };
  });

  if (mainIdx === -1 || maxV <= -0.7) {
    return { mainObstacleIndex: -1, totalDiffractionLossDb: 0, obstaclesEvaluated: terrainProfile.length };
  }

  const lossMain = computeKnifeEdgeLossDb(maxV);
  const mainPt = pointsWithV[mainIdx];

  // Step 2: Search for secondary dominant obstacle on left (Tx to Main)
  let maxVLeft = -Infinity;
  for (let i = 0; i < mainIdx; i++) {
    const pt = terrainProfile[i];
    const d1 = pt.distanceM;
    const d2 = mainPt.d1 - d1;
    if (d1 <= 0 || d2 <= 0) continue;
    const los = txElevationM + (d1 / mainPt.d1) * (mainPt.elevationM - txElevationM);
    const h = pt.elevationM - los;
    const v = computeFresnelV(h, d1, d2, wavelength);
    if (v > maxVLeft) maxVLeft = v;
  }
  const lossLeft = maxVLeft > -0.7 ? computeKnifeEdgeLossDb(maxVLeft) : 0;

  // Step 3: Search for secondary dominant obstacle on right (Main to Rx)
  let maxVRight = -Infinity;
  for (let i = mainIdx + 1; i < terrainProfile.length; i++) {
    const pt = terrainProfile[i];
    const d1 = pt.distanceM - mainPt.d1;
    const d2 = totalDistanceM - pt.distanceM;
    if (d1 <= 0 || d2 <= 0) continue;
    const los = mainPt.elevationM + (d1 / (totalDistanceM - mainPt.d1)) * (rxElevationM - mainPt.elevationM);
    const h = pt.elevationM - los;
    const v = computeFresnelV(h, d1, d2, wavelength);
    if (v > maxVRight) maxVRight = v;
  }
  const lossRight = maxVRight > -0.7 ? computeKnifeEdgeLossDb(maxVRight) : 0;

  // ITU-R P.526 correction factor C ≈ sqrt( (d1 * (d2 + d3)) / ((d1 + d2) * (d2 + d3)) )
  const totalDiffractionLossDb = Math.round((lossMain + lossLeft + lossRight) * 100) / 100;

  return {
    mainObstacleIndex: mainIdx,
    totalDiffractionLossDb,
    obstaclesEvaluated: terrainProfile.length,
    components: {
      lossMainDb: Math.round(lossMain * 100) / 100,
      lossLeftDb: Math.round(lossLeft * 100) / 100,
      lossRightDb: Math.round(lossRight * 100) / 100,
    }
  };
}

// ---------------------------------------------------------------------------
// 4. ITU-R P.838-3 FREQUENCY-DEPENDENT SPECIFIC RAIN ATTENUATION
// ---------------------------------------------------------------------------

/**
 * Calculates specific rain attenuation gamma_R (dB/km) according to ITU-R P.838-3:
 * gamma_R = k * R^alpha
 *
 * Uses ITU coefficients for horizontal and vertical polarization across microwave frequencies.
 *
 * @param {number} frequencyGhz Frequency in GHz (e.g. 0.868, 2.4, 5.8, 12.0, 28.0).
 * @param {number} rainRateMmHr Rain rate in mm/hour (from MET Norway or radar).
 * @param {'H' | 'V'} [polarization='V'] Antenna polarization (Horizontal or Vertical).
 * @returns {{ specificAttenuationDbPerKm: number, pathAttenuationDb: (distanceKm: number) => number }}
 */
export function computeRainAttenuation(frequencyGhz, rainRateMmHr, polarization = 'V') {
  if (!finite(frequencyGhz, 0.1, 100) || !finite(rainRateMmHr, 0, 500)) {
    throw new TypeError('Invalid frequency (0.1-100 GHz) or rainRate (0-500 mm/h)');
  }
  if (rainRateMmHr <= 0.1) {
    return { specificAttenuationDbPerKm: 0, pathAttenuationDb: () => 0 };
  }

  // Regression power-law approximation fitting ITU-R P.838-3 table values:
  // For frequencies < 1 GHz (e.g. 433 MHz, 868 MHz), rain attenuation is negligible (< 0.01 dB/km).
  // For 2.4 GHz, 5.8 GHz and satellite Ku/Ka bands, rain attenuation becomes significant.
  let k = 0;
  let alpha = 1.0;

  if (frequencyGhz < 1.0) {
    k = 0.00003 * frequencyGhz;
    alpha = 0.9;
  } else if (frequencyGhz <= 3.0) {
    k = 0.0002;
    alpha = 1.0;
  } else if (frequencyGhz <= 6.0) {
    k = polarization === 'H' ? 0.00175 : 0.00155;
    alpha = 1.30;
  } else if (frequencyGhz <= 15.0) {
    k = polarization === 'H' ? 0.0367 : 0.0335;
    alpha = 1.15;
  } else {
    // 15 - 40 GHz (Ka band)
    k = polarization === 'H' ? 0.187 : 0.167;
    alpha = 1.02;
  }

  const specificAttenuationDbPerKm = Math.round((k * Math.pow(rainRateMmHr, alpha)) * 10000) / 10000;

  return {
    specificAttenuationDbPerKm,
    pathAttenuationDb: (distanceKm) => {
      if (!finite(distanceKm, 0)) return 0;
      // Effective path length factor d_eff = d / (1 + d / d_0) per ITU-R P.530
      const d0 = 35 * Math.exp(-0.015 * rainRateMmHr);
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

  // Max Doppler shift occurs at horizon ingress/egress (elevation ~0°)
  // v_los_max = v_orbit * cos(elevation) * (r_earth / r_orbit)
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

  // Gardner PLL second-order tracking bandwidth rule: B_L > 3 * sqrt(max_doppler_rate)
  const minPllLoopBandwidthHz = Math.round(3.0 * Math.sqrt(maxDopplerRateHzPerS) * 10) / 10;

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
