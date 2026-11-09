/**
 * SENDA — COTS RF Tactical Reconnaissance, Passive Bistatic Radar & DIY Drone Detection
 *
 * Grounded in:
 *  - ASTM F3411-22a / ASD-STAN prEN 4709-002: Standard Specification for Remote ID and Tracking.
 *  - Passive Bistatic Radar (PBR) Cross-Ambiguity Function (CAF) & bistatic geometry.
 *  - Radio Direction Finding (DoA) via phase-difference interferometry.
 *  - Classical RF antenna synthesis (Balanis, Kraus): Yagi-Uda, QFH, Bi-Quad, Monopole.
 *
 * Enables sovereign civilian, search & rescue, and defense operations utilizing low-cost COTS
 * components (e.g. ESP32, RTL-SDR, nRF52840, copper wire, PVC pipe) costing under 5€–25€.
 */

export const SPEED_OF_LIGHT = 299792458; // m/s

function finite(val, min = -Infinity, max = Infinity) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

// ---------------------------------------------------------------------------
// 1. ASTM F3411 REMOTE ID DECODER & DRONE TRACKER (ESP32 / RTL-SDR COTS)
// ---------------------------------------------------------------------------

export const OPENDRONEID_MSG_TYPES = Object.freeze({
  BASIC_ID: 0x0,
  LOCATION_VECTOR: 0x1,
  AUTHENTICATION: 0x2,
  SELF_ID: 0x3,
  SYSTEM: 0x4,
  OPERATOR_ID: 0x5,
});

export const UAV_ID_TYPES = Object.freeze({
  0: 'NONE',
  1: 'SERIAL_NUMBER_ANSI_CTA_2063',
  2: 'CAA_REGISTRATION_ID',
  3: 'UTM_ASSIGNED_UUID',
  4: 'SPECIFIC_SESSION_ID',
});

/**
 * Decodes an ASTM F3411 / OpenDroneID message pack from an ESP32 or SDR receiver.
 *
 * @param {Uint8Array|number[]} rawBytes 25-byte raw OpenDroneID message payload.
 * @returns {object} Decoded and validated tactical drone telemetry.
 */
export function decodeRemoteIdMessage(rawBytes) {
  const bytes = Array.from(rawBytes);
  if (bytes.length < 25) {
    throw new TypeError('Invalid OpenDroneID message length (minimum 25 bytes)');
  }

  const header = bytes[0];
  const msgType = (header >> 4) & 0x0f;
  const protocolVersion = header & 0x0f;

  switch (msgType) {
    case OPENDRONEID_MSG_TYPES.BASIC_ID: {
      const idType = (bytes[1] >> 4) & 0x0f;
      const uavType = bytes[1] & 0x0f;
      let uavId = '';
      for (let i = 2; i < 22; i++) {
        if (bytes[i] === 0) break;
        uavId += String.fromCharCode(bytes[i]);
      }
      return {
        messageType: 'BASIC_ID',
        protocolVersion,
        idType: UAV_ID_TYPES[idType] || 'UNKNOWN',
        uavType,
        uavId: uavId.trim(),
      };
    }

    case OPENDRONEID_MSG_TYPES.LOCATION_VECTOR: {
      const status = (bytes[1] >> 4) & 0x0f;
      const trackDir = bytes[2] * 2; // 0..360 degrees
      const speedHoriz = bytes[3] * 0.25; // m/s (0.25 m/s resolution)
      const speedVert = (bytes[4] - 128) * 0.5; // m/s signed

      // Latitude and Longitude encoded as int32 in units of 1e-7 degrees
      const view = new DataView(new Uint8Array(bytes).buffer);
      const latInt = view.getInt32(5, true);
      const lonInt = view.getInt32(9, true);

      const lat = latInt * 1e-7;
      const lon = lonInt * 1e-7;

      // Altitudes encoded with 0.5m resolution and -1000m offset
      const altGeodeticM = view.getUint16(13, true) * 0.5 - 1000;
      const heightAglM = view.getUint16(15, true) * 0.5 - 1000;

      return {
        messageType: 'LOCATION_VECTOR',
        protocolVersion,
        operationalStatus: status === 1 ? 'AIRBORNE' : (status === 2 ? 'GROUND' : 'EMERGENCY'),
        trackHeadingDeg: trackDir,
        speedHorizontalMs: Math.round(speedHoriz * 10) / 10,
        speedVerticalMs: Math.round(speedVert * 10) / 10,
        latitude: Math.round(lat * 1e7) / 1e7,
        longitude: Math.round(lon * 1e7) / 1e7,
        altitudeGeodeticM: Math.round(altGeodeticM * 10) / 10,
        heightAglM: Math.max(0, Math.round(heightAglM * 10) / 10),
      };
    }

    case OPENDRONEID_MSG_TYPES.SYSTEM: {
      const flags = bytes[1];
      const operatorLocationType = flags & 0x03;

      const view = new DataView(new Uint8Array(bytes).buffer);
      const opLat = view.getInt32(2, true) * 1e-7;
      const opLon = view.getInt32(6, true) * 1e-7;
      const opAltM = view.getUint16(10, true) * 0.5 - 1000;

      return {
        messageType: 'SYSTEM_OPERATOR_LOCATION',
        protocolVersion,
        operatorLocationType: operatorLocationType === 0 ? 'TAKEOFF_LOCATION' : 'PILOT_GCS_LIVE_COORDINATES',
        pilotLatitude: Math.round(opLat * 1e7) / 1e7,
        pilotLongitude: Math.round(opLon * 1e7) / 1e7,
        pilotAltitudeM: Math.round(opAltM * 10) / 10,
      };
    }

    default:
      return {
        messageType: 'OTHER',
        rawType: msgType,
        protocolVersion,
        payloadBytes: bytes.slice(1),
      };
  }
}

// ---------------------------------------------------------------------------
// 2. PASSIVE BISTATIC RADAR (PBR) CROSS-AMBIGUITY & BISTATIC RANGE SOLVER
// ---------------------------------------------------------------------------

/**
 * Computes the bistatic range $R_{\text{bistat}}$ from bistatic time delay $\Delta \tau$:
 * $R_{\text{bistat}} = R_{Tx \to Target} + R_{Target \to Rx} - L_{\text{baseline}}$
 *
 * @param {number} delaySec Time delay difference in seconds between direct and surveillance paths.
 * @param {number} baselineDistanceM Distance in meters between transmitter (illuminator) and receiver.
 * @returns {{ bistaticRangeM: number, totalPathLengthM: number, delaySec: number }}
 */
export function calculateBistaticRange(delaySec, baselineDistanceM) {
  if (!finite(delaySec, 0) || !finite(baselineDistanceM, 0)) {
    throw new TypeError('Invalid delay or baseline distance');
  }

  const bistaticRangeM = delaySec * SPEED_OF_LIGHT;
  const totalPathLengthM = bistaticRangeM + baselineDistanceM;

  return {
    bistaticRangeM: Math.round(bistaticRangeM * 10) / 10,
    totalPathLengthM: Math.round(totalPathLengthM * 10) / 10,
    delaySec,
  };
}

/**
 * Computes the target Doppler velocity component in a bistatic radar geometry:
 * $f_d = \frac{v}{\lambda} (\cos(\theta_{Tx}) + \cos(\theta_{Rx}))$
 *
 * @param {number} dopplerShiftHz Measured Doppler shift in Hz.
 * @param {number} carrierFrequencyHz Carrier frequency in Hz (e.g. 100 MHz for FM, 600 MHz for DVB-T).
 * @param {number} bistaticAngleDeg Angle between transmitter-to-target and receiver-to-target vectors.
 * @returns {{ radialVelocityMs: number, radialVelocityKmh: number, wavelengthM: number }}
 */
export function calculateBistaticDopplerVelocity(dopplerShiftHz, carrierFrequencyHz, bistaticAngleDeg = 30) {
  if (!finite(dopplerShiftHz) || !finite(carrierFrequencyHz, 1e6, 1e11)) {
    throw new TypeError('Invalid Doppler shift or carrier frequency');
  }

  const wavelengthM = SPEED_OF_LIGHT / carrierFrequencyHz;
  const betaRad = (bistaticAngleDeg * Math.PI) / 180;
  // In bistatic radar, f_d = (2 * v_b / lambda) * cos(beta / 2)
  const bisectorFactor = Math.cos(betaRad / 2);
  const radialVelocityMs = Math.abs(bisectorFactor) > 1e-4
    ? (dopplerShiftHz * wavelengthM) / (2 * bisectorFactor)
    : 0;

  return {
    radialVelocityMs: Math.round(radialVelocityMs * 100) / 100,
    radialVelocityKmh: Math.round(radialVelocityMs * 3.6 * 10) / 10,
    wavelengthM: Math.round(wavelengthM * 1000) / 1000,
  };
}

/**
 * Evaluates the Cross-Ambiguity Function (CAF) slice for Passive Bistatic Radar:
 * $\chi(\tau, f_d) = \left| \sum_{n} s_{\text{surv}}[n] s_{\text{ref}}^*[n - \tau] e^{-j 2\pi f_d n / f_s} \right|$
 *
 * @param {Float32Array|number[]} refSignal Reference channel samples (direct illuminator signal).
 * @param {Float32Array|number[]} survSignal Surveillance channel samples (echo from airspace).
 * @param {number} sampleRateHz Sampling rate in Hz (e.g. 2.4 MSPS for RTL-SDR).
 * @param {number} targetDopplerHz Hypothesized target Doppler shift in Hz.
 * @param {number} maxLagSamples Maximum sample lag to search.
 * @returns {{ peakCorrelation: number, bestLagSamples: number, bestDelaySec: number, snrDb: number }}
 */
export function computePassiveRadarCafSlice(refSignal, survSignal, sampleRateHz, targetDopplerHz = 0, maxLagSamples = 128) {
  const n = Math.min(refSignal.length, survSignal.length);
  if (n < 64 || !finite(sampleRateHz, 1e3)) {
    throw new TypeError('Insufficient samples or invalid sample rate');
  }

  const lags = Math.min(maxLagSamples, Math.floor(n / 2));
  let peakVal = 0;
  let bestLag = 0;
  let meanVal = 0;

  for (let lag = 0; lag < lags; lag++) {
    let re = 0;
    let im = 0;
    const len = n - lag;

    for (let i = 0; i < len; i++) {
      const phase = (2 * Math.PI * targetDopplerHz * i) / sampleRateHz;
      const refVal = refSignal[i];
      const survVal = survSignal[i + lag];
      const prod = survVal * refVal;

      re += prod * Math.cos(phase);
      im -= prod * Math.sin(phase);
    }

    const mag = Math.sqrt(re * re + im * im) / len;
    meanVal += mag;

    if (mag > peakVal) {
      peakVal = mag;
      bestLag = lag;
    }
  }

  meanVal = meanVal / Math.max(1, lags);
  const snrDb = meanVal > 0 ? 20 * Math.log10(peakVal / meanVal) : 0;

  return {
    peakCorrelation: Math.round(peakVal * 1000) / 1000,
    bestLagSamples: bestLag,
    bestDelaySec: bestLag / sampleRateHz,
    snrDb: Math.round(snrDb * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// 3. DIRECTION OF ARRIVAL (DoA) INTERFEROMETRY & GONIOMETRY
// ---------------------------------------------------------------------------

/**
 * Computes Angle of Arrival (AoA / DoA) via phase-difference interferometry:
 * $\Delta \phi = \frac{2\pi d}{\lambda} \sin(\theta) \implies \theta = \arcsin\left(\frac{\Delta \phi \lambda}{2\pi d}\right)$
 *
 * @param {number} phaseDiffRad Measured phase difference between 2 antenna elements in radians (-pi..pi).
 * @param {number} frequencyHz Carrier frequency in Hz.
 * @param {number} antennaBaselineM Physical distance between antenna phase centers in meters.
 * @returns {{ azimuthDeg: number, phaseAmbiguity: boolean, baselineWavelengths: number }}
 */
export function calculateInterferometricDoA(phaseDiffRad, frequencyHz, antennaBaselineM) {
  if (!finite(phaseDiffRad, -Math.PI, Math.PI) || !finite(frequencyHz, 1e6, 1e11) || !finite(antennaBaselineM, 0.01, 10)) {
    throw new TypeError('Invalid DoA interferometry parameters');
  }

  const wavelength = SPEED_OF_LIGHT / frequencyHz;
  const baselineWavelengths = antennaBaselineM / wavelength;

  // For unambiguous DoA without grating lobes, d <= lambda / 2
  const phaseAmbiguity = baselineWavelengths > 0.55;

  const sinTheta = (phaseDiffRad * wavelength) / (2 * Math.PI * antennaBaselineM);
  const clampedSin = Math.max(-1.0, Math.min(1.0, sinTheta));
  const azimuthRad = Math.asin(clampedSin);
  const azimuthDeg = (azimuthRad * 180) / Math.PI;

  return {
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
    phaseAmbiguity,
    baselineWavelengths: Math.round(baselineWavelengths * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// 4. LOW-COST HOMEBREW ANTENNA SYNTHESIS (<5€ COTS MATERIALS)
// ---------------------------------------------------------------------------

/**
 * Designs homebrew antennas easily constructed with cheap wire, copper tape, and PVC:
 * - 1/4 Wavelength Groundplane (Monopole)
 * - Directional Bi-Quad (10–11 dBi)
 * - Quadrifilar Helix (QFH) for NOAA weather satellites & LEO CubeSats (137 MHz / 433 MHz)
 * - Yagi-Uda Directional Beam
 *
 * @param {number} targetFrequencyHz Center frequency in Hz (e.g. 137.5e6, 868e6, 1090e6, 2440e6).
 * @param {'MONOPOLE'|'BI_QUAD'|'QFH_SATELLITE'|'YAGI_UDA'} antennaType Antenna architecture.
 * @param {number} [velocityFactor=0.95] Copper wire velocity factor (typically 0.95).
 * @returns {object} Exact millimeter dimensions, gain, impedance, and assembly guide.
 */
export function calculateHomebrewAntennaDesign(targetFrequencyHz, antennaType = 'MONOPOLE', velocityFactor = 0.95) {
  if (!finite(targetFrequencyHz, 1e6, 3e10)) {
    throw new TypeError('Invalid target frequency');
  }

  const vf = finite(velocityFactor, 0.7, 1.0) ? velocityFactor : 0.95;
  const wavelengthMm = (SPEED_OF_LIGHT / targetFrequencyHz) * 1000;

  switch (antennaType) {
    case 'MONOPOLE': {
      // 1/4 wavelength vertical whip with 4 radials sloped at 45° for 50 Ohm match
      const drivenElementMm = (wavelengthMm / 4) * vf;
      const radialLengthMm = (wavelengthMm / 4) * 1.05; // radials ~5% longer
      return {
        antennaType: 'MONOPOLE_GROUNDPLANE_1_4',
        frequencyHz: targetFrequencyHz,
        wavelengthMm: Math.round(wavelengthMm * 10) / 10,
        drivenElementLengthMm: Math.round(drivenElementMm * 10) / 10,
        radialLengthMm: Math.round(radialLengthMm * 10) / 10,
        radialCount: 4,
        radialDroopAngleDeg: 45,
        feedpointImpedanceOhms: 50,
        expectedGainDbi: 2.15,
        polarization: 'VERTICAL_LINEAR',
        billOfMaterials: 'Conector SO-239 o BNC hembra (~1.50€) + alambre de cobre 1.5mm² (~0.50€)',
      };
    }

    case 'BI_QUAD': {
      // Dual diamond loops over a flat reflector plate (e.g. PCB or kitchen tray)
      // Side length = lambda / 4
      const sideLengthMm = (wavelengthMm / 4) * vf;
      const reflectorSpacingMm = wavelengthMm / 8; // optimal 0.125 lambda for ~50 Ohm match
      const reflectorWidthMm = wavelengthMm;
      const reflectorHeightMm = wavelengthMm * 0.6;
      return {
        antennaType: 'DOUBLE_BI_QUAD_DIRECTIONAL',
        frequencyHz: targetFrequencyHz,
        wavelengthMm: Math.round(wavelengthMm * 10) / 10,
        loopSideLengthMm: Math.round(sideLengthMm * 10) / 10,
        reflectorSpacingMm: Math.round(reflectorSpacingMm * 10) / 10,
        reflectorMinDimensionsMm: `${Math.round(reflectorWidthMm)} x ${Math.round(reflectorHeightMm)} mm`,
        feedpointImpedanceOhms: 50,
        expectedGainDbi: 11.2,
        polarization: 'HORIZONTAL_OR_VERTICAL',
        billOfMaterials: 'Alambre de cobre 2.5mm² (~1€) + placa de circuito o bandeja de aluminio (~2€)',
      };
    }

    case 'QFH_SATELLITE': {
      // Quadrifilar Helix (QFH) for NOAA weather satellites (137 MHz) or CubeSats (433 MHz)
      // RHCP polarization, hemispherical pattern, no rotator required!
      const outerLoopHeightMm = wavelengthMm * 0.56;
      const outerLoopRadiusMm = wavelengthMm * 0.18;
      const innerLoopHeightMm = wavelengthMm * 0.53;
      const innerLoopRadiusMm = wavelengthMm * 0.17;
      return {
        antennaType: 'QUADRIFILAR_HELIX_QFH',
        frequencyHz: targetFrequencyHz,
        wavelengthMm: Math.round(wavelengthMm * 10) / 10,
        outerLoopHeightMm: Math.round(outerLoopHeightMm * 10) / 10,
        outerLoopRadiusMm: Math.round(outerLoopRadiusMm * 10) / 10,
        innerLoopHeightMm: Math.round(innerLoopHeightMm * 10) / 10,
        innerLoopRadiusMm: Math.round(innerLoopRadiusMm * 10) / 10,
        polarization: 'RIGHT_HAND_CIRCULAR_RHCP',
        expectedGainDbi: 3.5,
        beamwidthDeg: 140,
        billOfMaterials: 'Tubo de PVC fontanería 32mm (~1.50€) + cable coaxial RG58 (~2€) + terminales faston (~0.50€)',
      };
    }

    case 'YAGI_UDA': {
      // 5-element directional Yagi-Uda beam for long-range drone/LoRa tracking
      const reflectorMm = wavelengthMm * 0.495;
      const drivenMm = wavelengthMm * 0.473 * vf;
      const director1Mm = wavelengthMm * 0.440;
      const director2Mm = wavelengthMm * 0.435;
      const director3Mm = wavelengthMm * 0.430;

      const spacingReflectorDrivenMm = wavelengthMm * 0.20;
      const spacingDrivenD1Mm = wavelengthMm * 0.15;
      const spacingD1D2Mm = wavelengthMm * 0.18;
      const spacingD2D3Mm = wavelengthMm * 0.20;
      const boomLengthTotalMm = spacingReflectorDrivenMm + spacingDrivenD1Mm + spacingD1D2Mm + spacingD2D3Mm;

      return {
        antennaType: 'YAGI_UDA_5_ELEMENT_BEAM',
        frequencyHz: targetFrequencyHz,
        wavelengthMm: Math.round(wavelengthMm * 10) / 10,
        boomLengthTotalMm: Math.round(boomLengthTotalMm * 10) / 10,
        elementsMm: [
          { name: 'Reflector', lengthMm: Math.round(reflectorMm * 10) / 10, positionOnBoomMm: 0 },
          { name: 'Driven Dipole', lengthMm: Math.round(drivenMm * 10) / 10, positionOnBoomMm: Math.round(spacingReflectorDrivenMm * 10) / 10 },
          { name: 'Director 1', lengthMm: Math.round(director1Mm * 10) / 10, positionOnBoomMm: Math.round((spacingReflectorDrivenMm + spacingDrivenD1Mm) * 10) / 10 },
          { name: 'Director 2', lengthMm: Math.round(director2Mm * 10) / 10, positionOnBoomMm: Math.round((spacingReflectorDrivenMm + spacingDrivenD1Mm + spacingD1D2Mm) * 10) / 10 },
          { name: 'Director 3', lengthMm: Math.round(director3Mm * 10) / 10, positionOnBoomMm: Math.round(boomLengthTotalMm * 10) / 10 },
        ],
        expectedGainDbi: 10.5,
        frontToBackRatioDb: 18.0,
        polarization: 'LINEAR',
        billOfMaterials: 'Listón de madera o canaleta PVC (~1.50€) + varillas de soldadura o perchas de alambre (~1.50€)',
      };
    }

    default:
      throw new TypeError(`Unknown antenna type: ${antennaType}`);
  }
}

// ---------------------------------------------------------------------------
// 5. SENDA COTS RESILIENCY PACKS CATALOG & BILL OF MATERIALS (BOM)
// ---------------------------------------------------------------------------

export const SENDA_COTS_HARDWARE_CATALOG = Object.freeze([
  {
    id: 'PACK_1',
    name: 'Centinela Táctico Radar 24 GHz + Acústico 3D',
    domain: 'TACTICAL_DRONE_DETECTION',
    physics: 'Doppler FMCW 24 GHz + TDoA Delay-and-Sum 3D + Bernoulli downwash',
    targetBudgetEur: 15.0,
    items: [
      { part: 'ESP32-S3 DevKit N16R8', unitPriceEur: 3.80, qty: 1 },
      { part: 'Radar HLK-LD2410B FMCW 24 GHz', unitPriceEur: 3.10, qty: 1 },
      { part: 'Micrófono MEMS I2S INMP441', unitPriceEur: 0.80, qty: 4 },
      { part: 'Barómetro BMP280 I2C', unitPriceEur: 0.90, qty: 1 },
      { part: 'Caja Estanca IP65 100x68', unitPriceEur: 1.50, qty: 1 },
    ],
  },
  {
    id: 'PACK_2',
    name: 'Micro-Sismógrafo e Infrasonidos DANA',
    domain: 'HYDROLOGICAL_EARLY_WARNING',
    physics: 'Onda barométrica infrasónica 0.05-2 Hz + Vibración sísmica fluvial',
    targetBudgetEur: 6.0,
    items: [
      { part: 'ESP32-C3 SuperMini', unitPriceEur: 1.80, qty: 1 },
      { part: 'Microbarómetro DPS310 0.02 Pa', unitPriceEur: 1.40, qty: 1 },
      { part: 'Acelerómetro LIS3DHTR', unitPriceEur: 0.90, qty: 1 },
      { part: 'Buzzer Piezo Pasivo 3V', unitPriceEur: 0.50, qty: 1 },
    ],
  },
  {
    id: 'PACK_3',
    name: 'Repetidor LoRa DTN Solar Autónomo',
    domain: 'LONG_RANGE_DTN_TELECOM',
    physics: 'Chirp Spread Spectrum CSS SF10-12 + ETSI g3 500mW ERP',
    targetBudgetEur: 22.0,
    items: [
      { part: 'Heltec WiFi LoRa 32 V3 SX1262', unitPriceEur: 12.20, qty: 1 },
      { part: 'Antena Fibra Vidrio 868 MHz 5.8 dBi', unitPriceEur: 2.80, qty: 1 },
      { part: 'Panel Solar Monocristalino 5V 2W', unitPriceEur: 1.40, qty: 1 },
      { part: 'Batería 18650 Li-Ion 2600 mAh', unitPriceEur: 1.40, qty: 1 },
    ],
  },
  {
    id: 'PACK_4',
    name: 'Sniffer Pasivo RF 8 GHz + Detector Arco',
    domain: 'ELECTRONIC_WARFARE_PASSIVE',
    physics: 'Radiometría logarítmica 70 dB rango sin oscilador local (0 dBm)',
    targetBudgetEur: 9.0,
    items: [
      { part: 'ESP32-C3 SuperMini', unitPriceEur: 1.80, qty: 1 },
      { part: 'Detector Logarítmico AD8318 8 GHz', unitPriceEur: 3.60, qty: 1 },
      { part: 'Antena Log-Periódica PCB 0.6-10 GHz', unitPriceEur: 1.50, qty: 1 },
    ],
  },
  {
    id: 'PACK_5',
    name: 'Baliza Infrarroja Anti-Humo NIR 850/940 nm',
    domain: 'SEARCH_AND_RESCUE_OPTICAL',
    physics: 'Dispersión Mie reducida 65% en ventana NIR + Modulación estroboscópica',
    targetBudgetEur: 5.0,
    items: [
      { part: 'ESP32-C3 SuperMini / ATtiny', unitPriceEur: 1.80, qty: 1 },
      { part: '2x LEDs Alta Potencia 3W NIR 850/940nm', unitPriceEur: 0.90, qty: 1 },
      { part: 'Driver MOSFET AO3400', unitPriceEur: 0.40, qty: 1 },
      { part: 'Portapilas 18650 con interruptor', unitPriceEur: 0.30, qty: 1 },
    ],
  },
  {
    id: 'PACK_6',
    name: 'Radar Bio-Médico UWB Vida bajo Escombros',
    domain: 'USAR_CONFINED_SPACE_LIFE_DETECTION',
    physics: 'Reflectometría de pulso ultracorto UWB ToF sub-ns + Fase torácica',
    targetBudgetEur: 15.0,
    items: [
      { part: 'ESP32-UWB con Decawave DWM1000', unitPriceEur: 8.90, qty: 1 },
      { part: 'Antena Planar Microstrip UWB 3-7 GHz', unitPriceEur: 1.20, qty: 1 },
      { part: 'Pantalla OLED 0.96 I2C', unitPriceEur: 1.20, qty: 1 },
      { part: 'Carcasa de mano ergonómica ABS', unitPriceEur: 0.60, qty: 1 },
    ],
  },
  {
    id: 'PACK_7',
    name: 'Termografía Radiométrica LWIR Anti-Humo',
    domain: 'THERMAL_NIGHT_SAR_FIREFIGHTING',
    physics: 'Radiometría Planck LWIR 8-14 µm + Dispersión Rayleigh mínima en hollín',
    targetBudgetEur: 25.0,
    items: [
      { part: 'Sensor Térmico MLX90640 (32x24 px)', unitPriceEur: 14.80, qty: 1 },
      { part: 'ESP32-S3 Mini N8R2', unitPriceEur: 3.20, qty: 1 },
      { part: 'Pantalla LCD IPS 1.14 ST7789 SPI', unitPriceEur: 1.40, qty: 1 },
    ],
  },
  {
    id: 'PACK_8',
    name: 'Sniffer Químico Pirólisis Pre-Llama',
    domain: 'EARLY_WILDFIRE_DETECTION',
    physics: 'Quimiorresistencia MOS Wolkenstein/Freundlich (H2, CO) pre-ignición',
    targetBudgetEur: 8.0,
    items: [
      { part: 'Sensor Digital VOC Sensirion SGP40', unitPriceEur: 2.90, qty: 1 },
      { part: 'Sensor Analógico MQ-135 CO/Humo', unitPriceEur: 0.90, qty: 1 },
      { part: 'ESP32-C3 SuperMini', unitPriceEur: 1.80, qty: 1 },
      { part: 'Buzzer Piezo 3V', unitPriceEur: 0.60, qty: 1 },
    ],
  },
  {
    id: 'PACK_9',
    name: 'Sonda TDR Humedad Combustible FDFM',
    domain: 'FOREST_FUEL_IGNITION_RISK',
    physics: 'Permitividad dieléctrica compleja Maxwell 1.5 MHz + Modelo Rothermel FDFM',
    targetBudgetEur: 5.0,
    items: [
      { part: 'Sensor Capacitivo de Suelo v2.0', unitPriceEur: 0.70, qty: 1 },
      { part: 'ESP32-C3 SuperMini con ADC', unitPriceEur: 1.80, qty: 1 },
      { part: 'Varillas Inoxidables AISI 316 (100 mm)', unitPriceEur: 0.60, qty: 1 },
    ],
  },
  {
    id: 'PACK_10',
    name: 'Magnetómetro Geofísico de Deslizamientos',
    domain: 'GEOLOGICAL_LANDSLIDE_WARNING',
    physics: 'Piezomagnetismo tectónico en rocas ferromagnéticas + Inclinometría',
    targetBudgetEur: 6.0,
    items: [
      { part: 'Magnetómetro Triaxial QMC5883L 0.2 µT', unitPriceEur: 1.10, qty: 1 },
      { part: 'Acelerómetro LIS3DHTR 16-bit', unitPriceEur: 0.90, qty: 1 },
      { part: 'ESP32-C3 SuperMini', unitPriceEur: 1.80, qty: 1 },
    ],
  },
  {
    id: 'PACK_11',
    name: 'Boya Fluvial DTN "Pato Táctico"',
    domain: 'RAPID_FLOOD_RIVER_TRACKING',
    physics: 'Flotabilidad de Arquímedes + Cinemática fluvial Saint-Venant + LoRa',
    targetBudgetEur: 18.0,
    items: [
      { part: 'Heltec WiFi LoRa 32 V3 SX1262', unitPriceEur: 11.20, qty: 1 },
      { part: 'Sensor Sumergible DS18B20 Inox', unitPriceEur: 0.90, qty: 1 },
      { part: 'Acelerómetro 6 DOF MPU6050', unitPriceEur: 0.90, qty: 1 },
      { part: 'Esfera Estanca IP68 90mm con plomo', unitPriceEur: 1.20, qty: 1 },
    ],
  },
  {
    id: 'PACK_12',
    name: 'Generador Termoeléctrico Seebeck Supervivencia',
    domain: 'EXTREME_SURVIVAL_ENERGY_HARVESTING',
    physics: 'Efecto termoeléctrico Seebeck en Bi2Te3 + Elevador DC-DC LTC3108',
    targetBudgetEur: 7.0,
    items: [
      { part: 'Célula Seebeck SP1848-27145', unitPriceEur: 2.30, qty: 1 },
      { part: 'Elevador Ultra-Bajo Voltaje LTC3108', unitPriceEur: 1.40, qty: 1 },
      { part: 'Disipador Aluminio 40x40 con pad', unitPriceEur: 1.00, qty: 1 },
    ],
  },
]);

export function getSendaHardwareCatalog() {
  return SENDA_COTS_HARDWARE_CATALOG;
}

export function computeSendaPackBOM(packId) {
  const pack = SENDA_COTS_HARDWARE_CATALOG.find((p) => p.id === packId);
  if (!pack) {
    throw new TypeError(`Unknown SENDA Hardware Pack ID: ${packId}`);
  }
  const totalCostEur = pack.items.reduce((sum, item) => sum + item.unitPriceEur * item.qty, 0);
  return {
    packId: pack.id,
    name: pack.name,
    domain: pack.domain,
    physics: pack.physics,
    targetBudgetEur: pack.targetBudgetEur,
    totalCostEur: +totalCostEur.toFixed(2),
    isWithinBudget: totalCostEur <= pack.targetBudgetEur,
    items: pack.items,
  };
}

export function computeMasterCrateBOM(crateType) {
  switch (crateType) {
    case 'EDC_PERSONAL': {
      const p4 = computeSendaPackBOM('PACK_4');
      const p5 = computeSendaPackBOM('PACK_5');
      const p9 = computeSendaPackBOM('PACK_9');
      const totalCostEur = +(p4.totalCostEur + p5.totalCostEur + p9.totalCostEur).toFixed(2);
      return {
        crateType,
        name: 'Kit EDC Personal de Supervivencia Individual',
        packs: [p4, p5, p9],
        totalCostEur,
        targetLimitEur: 15.0,
        isWithinBudget: totalCostEur <= 15.0,
      };
    }
    case 'BRIGADA_FORESTAL': {
      const p1 = computeSendaPackBOM('PACK_1');
      const p2 = computeSendaPackBOM('PACK_2');
      const p3 = computeSendaPackBOM('PACK_3');
      const p7 = computeSendaPackBOM('PACK_7');
      const p8 = computeSendaPackBOM('PACK_8');
      const totalCostEur = +(p1.totalCostEur * 2 + p2.totalCostEur * 2 + p3.totalCostEur + p7.totalCostEur + p8.totalCostEur * 2).toFixed(2);
      return {
        crateType,
        name: 'Kit Táctico de Brigada Forestal / Protección Civil',
        packs: [
          { ...p1, qty: 2 },
          { ...p2, qty: 2 },
          { ...p3, qty: 1 },
          { ...p7, qty: 1 },
          { ...p8, qty: 2 },
        ],
        totalCostEur,
        targetLimitEur: 90.0,
        isWithinBudget: totalCostEur <= 90.0,
      };
    }
    case 'TERRITORIAL_MUNICIPAL': {
      const p1 = computeSendaPackBOM('PACK_1');
      const p2 = computeSendaPackBOM('PACK_2');
      const p3 = computeSendaPackBOM('PACK_3');
      const p4 = computeSendaPackBOM('PACK_4');
      const p5 = computeSendaPackBOM('PACK_5');
      const p9 = computeSendaPackBOM('PACK_9');
      const p11 = computeSendaPackBOM('PACK_11');
      const p12 = computeSendaPackBOM('PACK_12');
      const totalCostEur = +(
        p1.totalCostEur * 4 +
        p2.totalCostEur * 4 +
        p3.totalCostEur * 3 +
        p4.totalCostEur * 1 +
        p5.totalCostEur * 3 +
        p9.totalCostEur * 1 +
        p11.totalCostEur * 1 +
        p12.totalCostEur * 1
      ).toFixed(2);
      return {
        crateType,
        name: 'Master Territorial Resiliency Crate (Comarca/Municipio)',
        packs: [
          { ...p1, qty: 4 },
          { ...p2, qty: 4 },
          { ...p3, qty: 3 },
          { ...p4, qty: 1 },
          { ...p5, qty: 3 },
          { ...p9, qty: 1 },
          { ...p11, qty: 1 },
          { ...p12, qty: 1 },
        ],
        totalCostEur,
        targetLimitEur: 165.0,
        isWithinBudget: totalCostEur <= 165.0,
      };
    }
    default:
      throw new TypeError(`Unknown crate type: ${crateType}`);
  }
}
