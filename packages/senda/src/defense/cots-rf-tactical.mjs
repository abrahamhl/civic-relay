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
 * Full relation: f_d = (2v/λ)·cos(δ)·cos(β/2), δ = angle between target velocity and the bistatic
 * bisector. Only the bisector component v·cos(δ) is observable from one Tx-Rx pair; that is what
 * `radialVelocityMs` returns.
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
