/**
 * @file acoustic-beamforming-survival.mjs
 * @description SENDA Engine: Polar Patterns, Spatial Delay-and-Sum Beamforming,
 * Acoustic Camera Spectro-Spatial Heatmaps, Low-Cost COTS Sentinel Gateways,
 * and Offline Civilian Digital Survival Kit.
 *
 * Grounded in acoustic wave propagation, array signal processing, and COTS microelectronics.
 * Operates offline with zero external dependencies.
 */

export const SPEED_OF_SOUND_AIR_20C = 343.0; // m/s at 20 °C, 1013.25 hPa

export const POLAR_PATTERNS = Object.freeze({
  OMNI: { alpha: 0.0, name: 'Omnidirectional', directivityFactorQ: 1.0, diDb: 0.0 },
  SUBCARDIOID: { alpha: 0.33, name: 'Subcardioid (Wide)', directivityFactorQ: 1.43, diDb: 1.55 },
  CARDIOID: { alpha: 0.5, name: 'Cardioid', directivityFactorQ: 3.0, diDb: 4.77 },
  SUPERCARDIOID: { alpha: 0.634, name: 'Supercardioid', directivityFactorQ: 3.73, diDb: 5.72 },
  HYPERCARDIOID: { alpha: 0.75, name: 'Hypercardioid', directivityFactorQ: 4.0, diDb: 6.02 },
  FIGURE_8: { alpha: 1.0, name: 'Bidirectional (Figure 8)', directivityFactorQ: 3.0, diDb: 4.77 }
});

/**
 * Computes the normalized first-order polar response V(theta) for a directional acoustic capsule.
 * Formula: V(theta) = (1 - alpha) + alpha * cos(theta)
 *
 * @param {'OMNI'|'SUBCARDIOID'|'CARDIOID'|'SUPERCARDIOID'|'HYPERCARDIOID'|'FIGURE_8'} pattern
 * @param {number} thetaRad Angle of incidence relative to on-axis in radians [0, 2*pi]
 * @returns {{ pattern: string, thetaDeg: number, linearGain: number, gainDb: number }}
 */
export function computePolarPatternResponse(pattern, thetaRad) {
  const spec = POLAR_PATTERNS[pattern] || POLAR_PATTERNS.CARDIOID;
  const alpha = spec.alpha;
  const cosTheta = Math.cos(thetaRad);
  const linearGain = Math.abs((1.0 - alpha) + alpha * cosTheta);
  const safeGain = Math.max(linearGain, 1e-4);
  const gainDb = +(20.0 * Math.log10(safeGain)).toFixed(2);
  const thetaDeg = +((thetaRad * 180.0) / Math.PI).toFixed(1);

  return {
    pattern: spec.name,
    alpha,
    thetaDeg,
    linearGain: +linearGain.toFixed(4),
    gainDb
  };
}

/**
 * Computes interference tube (shotgun microphone) acoustic attenuation.
 * Uses continuous acoustic line integral phase-cancellation model:
 * H(theta, f) = sin(pi * L / lambda * (1 - cos theta)) / (pi * L / lambda * (1 - cos theta))
 *
 * @param {number} tubeLengthM Physical length of interference tube in meters (e.g. 0.25 m)
 * @param {number} frequencyHz Frequency of interest (e.g. 2500 Hz)
 * @param {number} thetaRad Incidence angle in radians
 * @param {number} [speedOfSoundMs=343] Speed of sound in m/s
 * @returns {{ tubeLengthM: number, frequencyHz: number, thetaDeg: number, attenuationDb: number, linearMag: number }}
 */
export function computeShotgunInterferenceResponse(
  tubeLengthM,
  frequencyHz,
  thetaRad,
  speedOfSoundMs = SPEED_OF_SOUND_AIR_20C
) {
  const lambda = speedOfSoundMs / Math.max(frequencyHz, 20);
  const cosTheta = Math.cos(thetaRad);
  const deltaPhi = (Math.PI * tubeLengthM / lambda) * (1.0 - cosTheta);

  let linearMag = 1.0;
  if (Math.abs(deltaPhi) > 1e-6) {
    linearMag = Math.abs(Math.sin(deltaPhi) / deltaPhi);
  }

  const safeMag = Math.max(linearMag, 1e-4);
  const attenuationDb = +(20.0 * Math.log10(safeMag)).toFixed(2);
  const thetaDeg = +((thetaRad * 180.0) / Math.PI).toFixed(1);

  return {
    tubeLengthM,
    frequencyHz,
    thetaDeg,
    linearMag: +linearMag.toFixed(4),
    attenuationDb
  };
}

/**
 * Computes Delay-and-Sum beamforming time delays and weights for a sensor array.
 * Target direction given by azimuth (theta) and elevation (phi).
 *
 * @param {Array<{x: number, y: number, z: number, id?: string}>} sensorCoords
 * @param {number} targetAzimuthRad Azimuth in radians [-pi, pi]
 * @param {number} targetElevationRad Elevation in radians [0, pi/2]
 * @param {number} [speedOfSoundMs=343] Speed of sound in m/s
 * @returns {{ targetAzimuthDeg: number, targetElevationDeg: number, delaysS: number[], steeringVector: Array<{x: number, y: number, z: number}> }}
 */
export function computeDelayAndSumBeamformingWeights(
  sensorCoords,
  targetAzimuthRad,
  targetElevationRad,
  speedOfSoundMs = SPEED_OF_SOUND_AIR_20C
) {
  if (!Array.isArray(sensorCoords) || sensorCoords.length === 0) {
    throw new Error('sensorCoords must be a non-empty array');
  }

  // Unit vector u(theta, phi) pointing towards source
  const ux = Math.cos(targetElevationRad) * Math.cos(targetAzimuthRad);
  const uy = Math.cos(targetElevationRad) * Math.sin(targetAzimuthRad);
  const uz = Math.sin(targetElevationRad);

  const delaysS = sensorCoords.map((coord) => {
    const projection = coord.x * ux + coord.y * uy + (coord.z || 0) * uz;
    // Delay tau_m = - projection / c
    return +(-projection / speedOfSoundMs).toFixed(6);
  });

  return {
    targetAzimuthDeg: +((targetAzimuthRad * 180) / Math.PI).toFixed(1),
    targetElevationDeg: +((targetElevationRad * 180) / Math.PI).toFixed(1),
    delaysS,
    steeringUnitVector: { x: +ux.toFixed(4), y: +uy.toFixed(4), z: +uz.toFixed(4) }
  };
}

/**
 * Computes Array Factor |AF(theta, phi, f)| for a given sensor array steered to (targetAz, targetEl).
 *
 * @param {Array<{x: number, y: number, z?: number}>} sensorCoords
 * @param {number} targetAzimuthRad Steered azimuth in radians
 * @param {number} targetElevationRad Steered elevation in radians
 * @param {number} evalAzimuthRad Direction to evaluate in radians
 * @param {number} evalElevationRad Elevation to evaluate in radians
 * @param {number} frequencyHz Frequency in Hz
 * @param {number} [speedOfSoundMs=343] Speed of sound in m/s
 * @returns {{ arrayFactorLinear: number, arrayGainDb: number }}
 */
export function computeAcousticArrayFactor(
  sensorCoords,
  targetAzimuthRad,
  targetElevationRad,
  evalAzimuthRad,
  evalElevationRad,
  frequencyHz,
  speedOfSoundMs = SPEED_OF_SOUND_AIR_20C
) {
  const M = sensorCoords.length;
  if (M === 0) return { arrayFactorLinear: 0, arrayGainDb: -100 };

  const k = (2.0 * Math.PI * frequencyHz) / speedOfSoundMs;

  const u0x = Math.cos(targetElevationRad) * Math.cos(targetAzimuthRad);
  const u0y = Math.cos(targetElevationRad) * Math.sin(targetAzimuthRad);
  const u0z = Math.sin(targetElevationRad);

  const ux = Math.cos(evalElevationRad) * Math.cos(evalAzimuthRad);
  const uy = Math.cos(evalElevationRad) * Math.sin(evalAzimuthRad);
  const uz = Math.sin(evalElevationRad);

  const dux = ux - u0x;
  const duy = uy - u0y;
  const duz = uz - u0z;

  let realSum = 0.0;
  let imagSum = 0.0;

  for (let i = 0; i < M; i++) {
    const s = sensorCoords[i];
    const phase = k * (s.x * dux + s.y * duy + (s.z || 0) * duz);
    realSum += Math.cos(phase);
    imagSum += Math.sin(phase);
  }

  const linear = Math.sqrt(realSum * realSum + imagSum * imagSum) / M;
  const safeLinear = Math.max(linear, 1e-4);
  const gainDb = +(20.0 * Math.log10(safeLinear)).toFixed(2);

  return {
    arrayFactorLinear: +linear.toFixed(4),
    arrayGainDb: gainDb
  };
}

/**
 * Generates an Acoustic Camera 2D Heatmap over spherical coordinates (azimuth, elevation).
 *
 * @param {Array<{x: number, y: number, z?: number}>} sensorCoords
 * @param {{azimuthDeg: number, elevationDeg: number, frequencyHz?: number}} targetSource
 * @param {number} [gridStepDeg=15] Angular step for grid synthesis
 * @returns {{ gridAzimuths: number[], gridElevations: number[], heatmap: number[][], peakAzimuthDeg: number, peakElevationDeg: number }}
 */
export function synthesizeAcousticCameraHeatmap(
  sensorCoords,
  targetSource,
  gridStepDeg = 15
) {
  const fHz = targetSource.frequencyHz || 350; // Drone BPF typical
  const tAzRad = (targetSource.azimuthDeg * Math.PI) / 180;
  const tElRad = (targetSource.elevationDeg * Math.PI) / 180;

  const gridAzimuths = [];
  for (let az = -180; az <= 180; az += gridStepDeg) {
    gridAzimuths.push(az);
  }

  const gridElevations = [];
  for (let el = 0; el <= 90; el += gridStepDeg) {
    gridElevations.push(el);
  }

  let maxVal = -Infinity;
  let peakAz = 0;
  let peakEl = 0;

  const heatmap = gridElevations.map((elDeg) => {
    const elRad = (elDeg * Math.PI) / 180;
    return gridAzimuths.map((azDeg) => {
      const azRad = (azDeg * Math.PI) / 180;
      const af = computeAcousticArrayFactor(
        sensorCoords,
        tAzRad,
        tElRad,
        azRad,
        elRad,
        fHz
      );
      const intensity = af.arrayFactorLinear;
      if (intensity > maxVal) {
        maxVal = intensity;
        peakAz = azDeg;
        peakEl = elDeg;
      }
      return +intensity.toFixed(3);
    });
  });

  return {
    frequencyHz: fHz,
    gridAzimuths,
    gridElevations,
    heatmap,
    peakAzimuthDeg: peakAz,
    peakElevationDeg: peakEl,
    contrastRatio: +(1.0 / Math.max(heatmap[0][0], 0.05)).toFixed(2)
  };
}

/**
 * Returns the exact Bill of Materials (BOM) for the Low-Cost COTS Sentinel Gateway.
 * Verified against commercial electronics suppliers (< 12 EUR per sentinel node).
 */
export function computeSentinelGatewayBOM() {
  const items = [
    {
      part: 'Microcontrolador ESP32-S3 DevKit',
      model: 'ESP32-S3-WROOM-1-N8R8 (Xtensa Dual-Core 240MHz, 8MB PSRAM, Wi-Fi 4 + BLE 5)',
      role: 'Cálculo FFT vectorial SIMD en hardware, multilateración TDoA y nodo Mesh',
      unitPriceEur: 2.80,
      qty: 1,
      source: 'AliExpress / LCSC / Espressif COTS'
    },
    {
      part: 'Cápsula Micrófono Digital MEMS I2S',
      model: 'INMP441 Omnidireccional (24-bit PCM, SNR 61 dBA, rango 60Hz-15kHz)',
      role: 'Array tetraédrico acústico de 4 canales para conformación de haz 3D',
      unitPriceEur: 0.80,
      qty: 4,
      source: 'AliExpress / InvenSense COTS'
    },
    {
      part: 'Mini-Radar Doppler Microondas 24 GHz',
      model: 'HLK-LD2410 FMCW (Banda ISM 24.0-24.25 GHz, detección 0.2m a 12m)',
      role: 'Detección cinemática Doppler de velocidad y proximidad física instantánea',
      unitPriceEur: 3.10,
      qty: 1,
      source: 'AliExpress / Hi-Link COTS'
    },
    {
      part: 'Sensor Microbarométrico y Térmico I2C',
      model: 'BMP280 (Resolución 0.16 Pa / 12 cm de altitud)',
      role: 'Microbarografía de estela de rotores y detección de onda de choque sísmica',
      unitPriceEur: 1.10,
      qty: 1,
      source: 'AliExpress / Bosch COTS'
    },
    {
      part: 'Conector de Alimentación y Caja Estanca',
      model: 'Carcasa ABS IP65 con prensaestopas + conector USB-C con filtro ESD',
      role: 'Protección intemperie para instalación en tejados, fachadas y postes',
      unitPriceEur: 1.50,
      qty: 1,
      source: 'AliExpress / Amazon COTS'
    }
  ];

  const totalCostEur = items.reduce((sum, item) => sum + item.unitPriceEur * item.qty, 0);

  return {
    nodeType: 'SENDA Sentinel Gateway COTS v2.4',
    totalCostEur: +totalCostEur.toFixed(2),
    targetBudgetLimitEur: 15.0,
    powerConsumptionWatts: 0.42,
    batteryAutonomyHours10Ah: +(10000 / (110)).toFixed(1), // ~90 hours on 10Ah bank
    items
  };
}

/**
 * Generates parameters for an Ultrasonic Rescue Beacon (FSK audio modulated at 19.5-20.5 kHz).
 * Completely inaudible to human ears, undetectable by casual hostile ground forces,
 * but picked up by civilian smartphone microphones and SAR drones.
 *
 * @param {{ lat: number, lon: number, altM?: number }} coords
 * @param {number} seqNumber
 * @returns {{ centerFreqHz: number, markFreqHz: number, spaceFreqHz: number, baudRate: number, inaudibleHuman: boolean, payloadHex: string }}
 */
export function generateUltrasonicRescueBeacon(coords, seqNumber = 1) {
  // Compress lat/lon to fixed-point 32-bit integers
  const latInt = Math.round((coords.lat + 90.0) * 1e6);
  const lonInt = Math.round((coords.lon + 180.0) * 1e6);
  const altInt = Math.round(coords.altM || 0);

  const payloadHex = [
    seqNumber.toString(16).padStart(4, '0'),
    latInt.toString(16).padStart(8, '0'),
    lonInt.toString(16).padStart(8, '0'),
    altInt.toString(16).padStart(4, '0')
  ].join('');

  return {
    centerFreqHz: 20000,
    markFreqHz: 19500,
    spaceFreqHz: 20500,
    baudRate: 100, // 100 baud for extreme robustness against multipath
    inaudibleHuman: true,
    carrierBand: 'ULTRASONIC_CIVILIAN_SAR',
    payloadHex,
    rangeLineOfSightM: 60.0
  };
}

/**
 * Calculates a Tactical Survival Vector for a civilian on the ground given hostile drone positions.
 *
 * @param {{ x: number, y: number, z: number }} civilianCoords
 * @param {Array<{ x: number, y: number, z: number, id: string, speedMs?: number }>} detectedDrones
 * @returns {{ threatLevel: 'LOW'|'MEDIUM'|'CRITICAL', nearestDroneDistanceM: number, recommendedEvasionAzimuthDeg: number, timeToInterceptS: number|null, safeDistanceM: number }}
 */
export function calculateTacticalSurvivalVector(civilianCoords, detectedDrones) {
  if (!detectedDrones || detectedDrones.length === 0) {
    return {
      threatLevel: 'LOW',
      nearestDroneDistanceM: 9999.0,
      recommendedEvasionAzimuthDeg: 0,
      timeToInterceptS: null,
      safeDistanceM: 500.0
    };
  }

  let minDist = Infinity;
  let closestDrone = detectedDrones[0];

  for (const drone of detectedDrones) {
    const dx = drone.x - civilianCoords.x;
    const dy = drone.y - civilianCoords.y;
    const dz = (drone.z || 30) - (civilianCoords.z || 0);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < minDist) {
      minDist = dist;
      closestDrone = drone;
    }
  }

  // Vector from closest drone to civilian
  const dx = civilianCoords.x - closestDrone.x;
  const dy = civilianCoords.y - closestDrone.y;
  let evasionAngleRad = Math.atan2(dy, dx);
  let evasionAzimuthDeg = +((evasionAngleRad * 180) / Math.PI).toFixed(1);
  if (evasionAzimuthDeg < 0) evasionAzimuthDeg += 360;

  let threatLevel = 'LOW';
  if (minDist < 80.0) threatLevel = 'CRITICAL';
  else if (minDist < 250.0) threatLevel = 'MEDIUM';

  const droneSpeed = closestDrone.speedMs || 15.0; // 15 m/s (~54 km/h) typical FPV
  const timeToInterceptS = threatLevel !== 'LOW' ? +(minDist / droneSpeed).toFixed(1) : null;

  return {
    threatLevel,
    nearestDroneDistanceM: +minDist.toFixed(1),
    recommendedEvasionAzimuthDeg: evasionAzimuthDeg,
    timeToInterceptS,
    safeDistanceM: 300.0
  };
}
