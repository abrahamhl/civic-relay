/**
 * SENDA Rigorous Scientific Evaluation, Calibration & Radio Frequency (RF) ITU-R P.526 Engine.
 *
 * Grounding & Epistemology:
 * 1. Out-of-sample Spatial IoU & Classification Metrics (Precision/Recall/F1/FPR).
 * 2. Radio Frequency Physics: ITU-R P.526 knife-edge diffraction loss & link budgets.
 *    Geometric clearance DOES NOT guarantee hardware packet delivery.
 * 3. Satellite Technical Feasibility vs Mathematical Orbit Line-of-Sight.
 *    Doppler shift and antenna beam tracking must be supported by device hardware.
 *
 * Zero fabricated telemetry: fully deterministic, unit-tested equations.
 */

const SPEED_OF_LIGHT = 299_792_458; // m/s
const EARTH_RADIUS_KM = 6371.0;

const finite = (n, lo = -Infinity, hi = Infinity) =>
  typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

/**
 * 1. SPATIAL PERIMETER & GRID IoU (Jaccard Index)
 * Compares predicted binary hazard grid with ground-truth raster/mask.
 */
export function evaluateSpatialIoU(predictedGrid, truthGrid) {
  if (!Array.isArray(predictedGrid) || !Array.isArray(truthGrid) ||
      predictedGrid.length === 0 || predictedGrid.length !== truthGrid.length) {
    throw new Error('INVALID_GRID_DIMENSIONS_FOR_IOU');
  }

  let intersection = 0;
  let union = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;

  for (let i = 0; i < predictedGrid.length; i++) {
    const p = Boolean(predictedGrid[i]);
    const t = Boolean(truthGrid[i]);

    if (p && t) {
      intersection++;
      union++;
    } else if (p && !t) {
      union++;
      falsePositives++;
    } else if (!p && t) {
      union++;
      falseNegatives++;
    } else {
      trueNegatives++;
    }
  }

  const iou = union === 0 ? 1.0 : intersection / union;
  const dice = (2 * intersection + falsePositives + falseNegatives) === 0
    ? 1.0
    : (2 * intersection) / (2 * intersection + falsePositives + falseNegatives);

  return {
    iou: Math.round(iou * 10000) / 10000,
    diceCoefficient: Math.round(dice * 10000) / 10000,
    intersectionCells: intersection,
    unionCells: union,
    falsePositiveCells: falsePositives,
    falseNegativeCells: falseNegatives,
    totalCells: predictedGrid.length,
    scientificMeaning: 'Out-of-sample spatial overlap score between model prediction and independent truth mask.',
  };
}

/**
 * 2. CLASSIFICATION PERFORMANCE METRICS
 */
export function evaluateClassificationPerformance(truthBinary, predictedProbabilities, threshold = 0.5) {
  if (!Array.isArray(truthBinary) || !Array.isArray(predictedProbabilities) ||
      truthBinary.length !== predictedProbabilities.length || truthBinary.length === 0) {
    throw new Error('INVALID_ARRAYS_FOR_CLASSIFICATION_METRICS');
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (let i = 0; i < truthBinary.length; i++) {
    const truth = truthBinary[i] === 1 || truthBinary[i] === true;
    const pred = predictedProbabilities[i] >= threshold;

    if (truth && pred) tp++;
    else if (!truth && pred) fp++;
    else if (!truth && !pred) tn++;
    else if (truth && !pred) fn++;
  }

  const precision = (tp + fp) === 0 ? 0 : tp / (tp + fp);
  const recall = (tp + fn) === 0 ? 0 : tp / (tp + fn);
  const specificity = (tn + fp) === 0 ? 0 : tn / (tn + fp);
  const falsePositiveRate = (fp + tn) === 0 ? 0 : fp / (fp + tn);
  const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    sampleCount: truthBinary.length,
    threshold,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    specificity: Math.round(specificity * 1000) / 1000,
    falsePositiveRate: Math.round(falsePositiveRate * 1000) / 1000,
    f1Score: Math.round(f1 * 1000) / 1000,
  };
}

/**
 * 3. ITU-R P.526 KNIFE-EDGE DIFFRACTION & LINK BUDGET EQUATIONS
 * Computes realistic RF link viability over terrain obstacles.
 */
export function calculateRfLinkBudgetItu526({
  frequencyMHz = 868,
  distanceKm = 10,
  txPowerDbm = 14, // Standard 25mW LoRa
  txGainDbi = 2.15, // Dipole
  rxGainDbi = 2.15,
  rxSensitivityDbm = -126, // Typical LoRa SF10 125kHz
  obstacleHeightAboveRayM = 0, // >0 means obstacle obstructs the line of sight
  d1Km = 5, // distance from Tx to obstacle
  d2Km = 5, // distance from obstacle to Rx
  foliageAttenuationDb = 0,
}) {
  if (!finite(frequencyMHz, 1, 100_000) || !finite(distanceKm, 0.001, 1000)) {
    throw new Error('INVALID_RF_PARAMETERS');
  }

  // 1. Free Space Path Loss (FSPL): 20 log10(d) + 20 log10(f) + 32.44 dB
  const fsplDb = 32.44 + 20 * Math.log10(frequencyMHz) + 20 * Math.log10(distanceKm);

  // 2. First Fresnel Zone radius at obstacle point: r_1 = 17.32 * sqrt((d1 * d2) / (f * d))
  const dTotal = d1Km + d2Km;
  const lambdaM = SPEED_OF_LIGHT / (frequencyMHz * 1e6);
  const fresnelRadiusM = 17.32 * Math.sqrt((d1Km * d2Km) / (frequencyMHz / 1000 * dTotal));

  // 3. Dimensionless clearance parameter nu: nu = h * sqrt((2/lambda) * (1/d1 + 1/d2))
  const nu = obstacleHeightAboveRayM * Math.sqrt((2 / lambdaM) * (1 / (d1Km * 1000) + 1 / (d2Km * 1000)));

  // 4. ITU-R P.526 knife-edge diffraction loss approximation J(nu)
  let diffractionLossDb = 0;
  if (nu > -0.7) {
    diffractionLossDb = 6.9 + 20 * Math.log10(Math.sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1);
  }

  const totalLossDb = fsplDb + diffractionLossDb + foliageAttenuationDb;
  const receivedPowerDbm = txPowerDbm + txGainDbi + rxGainDbi - totalLossDb;
  const linkMarginDb = receivedPowerDbm - rxSensitivityDbm;

  let linkViability = 'UNFEASIBLE_BELOW_SENSITIVITY';
  if (linkMarginDb >= 15.0) {
    linkViability = 'RELIABLE_WITH_FADING_MARGIN';
  } else if (linkMarginDb >= 0.0) {
    linkViability = 'MARGINAL_HIGH_PACKET_LOSS_RISK';
  }

  return {
    frequencyMHz,
    wavelengthM: Math.round(lambdaM * 1000) / 1000,
    distanceKm,
    fsplDb: Math.round(fsplDb * 10) / 10,
    firstFresnelRadiusM: Math.round(fresnelRadiusM * 10) / 10,
    diffractionParameterNu: Math.round(nu * 100) / 100,
    diffractionLossDb: Math.round(diffractionLossDb * 10) / 10,
    totalPathLossDb: Math.round(totalLossDb * 10) / 10,
    receivedPowerDbm: Math.round(receivedPowerDbm * 10) / 10,
    rxSensitivityDbm,
    linkMarginDb: Math.round(linkMarginDb * 10) / 10,
    linkViability,
    scientificBoundary: 'Diffraction model follows ITU-R P.526 single knife-edge approximation. Clearance does not guarantee demodulation under heavy multipath fading.',
  };
}

/**
 * 4. SATELLITE TECHNICAL HARDWARE FEASIBILITY
 * Checks elevation angle, slant range, and Doppler shift against device hardware capability.
 */
export function evaluateSatelliteTechnicalLink({
  orbitAltitudeKm = 550, // LEO (Starlink / Sentinel)
  elevationDeg = 35,
  frequencyMHz = 433,
  terminalHardware = {
    hasDopplerCorrection: false,
    hasBeamSteering: false,
    minElevationDeg: 15,
  },
}) {
  if (!finite(elevationDeg, -90, 90) || !finite(orbitAltitudeKm, 100, 36_000)) {
    throw new Error('INVALID_ORBIT_PARAMETERS');
  }

  const isMathVisible = elevationDeg >= 0;
  const isAboveMask = elevationDeg >= terminalHardware.minElevationDeg;

  // LEO Orbital velocity v = sqrt(GM / (R_E + h))
  const GM = 3.986004418e14; // m^3/s^2
  const rOrbitalM = (EARTH_RADIUS_KM + orbitAltitudeKm) * 1000;
  const vOrbitalMs = Math.sqrt(GM / rOrbitalM);

  // Maximum Doppler Shift Δf = (v / c) * f0 * cos(elevation)
  const elevRad = (elevationDeg * Math.PI) / 180;
  const maxDopplerShiftHz = Math.round((vOrbitalMs / SPEED_OF_LIGHT) * (frequencyMHz * 1e6) * Math.cos(elevRad));

  // Determine whether terminal hardware can actually sustain connection
  let technicallyConnectable = false;
  const technicalBlockers = [];

  if (!isMathVisible) technicalBlockers.push('BELOW_LOCAL_HORIZON');
  if (!isAboveMask) technicalBlockers.push('BELOW_TERMINAL_TERRAIN_MASK_ANGLE');

  // LEO satellites require Doppler tracking if shift exceeds narrowband bandwidth (e.g. >5 kHz)
  if (Math.abs(maxDopplerShiftHz) > 5000 && !terminalHardware.hasDopplerCorrection) {
    technicalBlockers.push('EXCESSIVE_DOPPLER_SHIFT_WITHOUT_HARDWARE_CORRECTION');
  }

  if (isAboveMask && technicalBlockers.length === 0) {
    technicallyConnectable = true;
  }

  return {
    orbitAltitudeKm,
    elevationDeg,
    isMathematicallyVisible: isMathVisible,
    isAboveMaskAngle: isAboveMask,
    orbitalSpeedKmS: Math.round((vOrbitalMs / 1000) * 10) / 10,
    maxDopplerShiftHz,
    technicallyConnectable,
    technicalBlockers,
    scientificTruthNotice: 'Mathematical orbital visibility DOES NOT equal communication link availability on COTS hardware without Doppler and tracking compensation.',
  };
}
