// RF propagation models for the Sensing Lab.
//
// Everything here is a MODEL, not a measurement. The material table is an
// engineering approximation in the spirit of ITU-R P.2040 material classes; it
// is not a survey of any specific building. The UI must render the provenance
// and the uncertainty, never a bare number that looks measured.
//
// Legal posture is encoded as data (`getRfLegalGates`) so the interface cannot
// quietly drop it: consented devices only, no IMSI catcher, no SS7, no identity
// resolution, no through-wall capability claim.

export const SPEED_OF_LIGHT_MPS = 299_792_458;

export const RF_STATUS = Object.freeze({
  ROBUST: 'ROBUST',
  MARGINAL: 'MARGINAL',
  BLOCKED: 'BLOCKED',
  BLOCKED_BY_MATERIAL: 'BLOCKED_BY_MATERIAL',
  BLOCKED_BY_PATH_LOSS: 'BLOCKED_BY_PATH_LOSS',
  PLAUSIBLE_SIMULATION_ONLY: 'PLAUSIBLE_SIMULATION_ONLY',
  MARGINAL_SIMULATION_ONLY: 'MARGINAL_SIMULATION_ONLY',
});

/**
 * @typedef {Object} WallSpec
 * @property {string} material
 * @property {number} thicknessM
 */

/**
 * One-way attenuation coefficients, normalised to 2.4 GHz.
 * `dbPerMeterAt2_4GHz * thicknessM` reproduces the order of magnitude quoted in
 * the note at 2.4 GHz. Frequency scaling is a power law, not a measurement.
 */
/** @type {Record<string, {label: string, dbPerMeterAt2_4GHz: number, frequencyExponent: number, note: string}>} */
export const MATERIALS = Object.freeze({
  drywall: {
    label: 'Pladur / yeso laminado',
    dbPerMeterAt2_4GHz: 180,
    frequencyExponent: 0.8,
    note: '~2.3 dB a 2.4 GHz con 12.7 mm',
  },
  wood: {
    label: 'Madera',
    dbPerMeterAt2_4GHz: 120,
    frequencyExponent: 0.8,
    note: '~3 dB a 2.4 GHz con 25 mm',
  },
  glass: {
    label: 'Vidrio',
    dbPerMeterAt2_4GHz: 400,
    frequencyExponent: 0.9,
    note: '~2.4 dB a 2.4 GHz con 6 mm',
  },
  brick: {
    label: 'Ladrillo',
    dbPerMeterAt2_4GHz: 80,
    frequencyExponent: 0.9,
    note: '~8 dB a 2.4 GHz con 100 mm',
  },
  concrete: {
    label: 'Hormigón',
    dbPerMeterAt2_4GHz: 100,
    frequencyExponent: 0.9,
    note: '~20 dB a 2.4 GHz con 200 mm',
  },
  reinforced_concrete: {
    label: 'Hormigón armado',
    dbPerMeterAt2_4GHz: 175,
    frequencyExponent: 0.9,
    note: '~35 dB a 2.4 GHz con 200 mm; malla metálica',
  },
  metal: {
    label: 'Metal / chapa',
    dbPerMeterAt2_4GHz: 40_000,
    frequencyExponent: 0.5,
    note: '~40 dB con 1 mm; barrera efectiva',
  },
  earth: {
    label: 'Tierra / escombro',
    dbPerMeterAt2_4GHz: 300,
    frequencyExponent: 0.9,
    note: '~90 dB con 300 mm; no atraviesa de forma útil',
  },
});

export const RF_LEGAL_GATES = Object.freeze([
  {
    id: 'consented_devices_only',
    status: 'REQUIRED',
    statement:
      'Solo se cuentan dispositivos propios o con consentimiento escrito del titular y del recinto.',
  },
  {
    id: 'no_imsi_catcher',
    status: 'PROHIBITED',
    statement: 'No se implementa ni se simula captura de IMSI/IMEI ni suplantación de red móvil.',
  },
  {
    id: 'no_ss7',
    status: 'PROHIBITED',
    statement: 'No hay acceso a SS7, HLR, operadores ni localización por red celular.',
  },
  {
    id: 'no_identity_resolution',
    status: 'NOT_IMPLEMENTED',
    statement: 'No se resuelve identidad de personas ni se enlaza un dispositivo con un nombre.',
  },
  {
    id: 'no_warrantless_tracking',
    status: 'PROHIBITED',
    statement: 'Sin orden judicial o base legal equivalente no se rastrea a terceros.',
  },
  {
    id: 'through_wall_simulation_only',
    status: 'SIMULATION_ONLY',
    statement:
      'La atenuación y el mapa de presencia son un modelo físico marcado SIMULATOR; no son una capacidad de detección real.',
  },
]);

export function dbmToMw(dbm) {
  return 10 ** (dbm / 10);
}

export function mwToDbm(mw) {
  if (!(mw > 0)) throw new RangeError('mW must be positive');
  return 10 * Math.log10(mw);
}

export function freeSpacePathLossDb(distanceM, freqHz) {
  if (!(distanceM > 0)) throw new RangeError('distanceM must be positive');
  if (!(freqHz > 0)) throw new RangeError('freqHz must be positive');
  return (
    20 * Math.log10(distanceM) +
    20 * Math.log10(freqHz) +
    20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT_MPS)
  );
}

export function materialAttenuationDb({ material, thicknessM, freqHz }) {
  const entry = MATERIALS[material];
  if (!entry) throw new RangeError(`unknown material: ${material}`);
  if (!(thicknessM >= 0)) throw new RangeError('thicknessM must be >= 0');
  if (!(freqHz > 0)) throw new RangeError('freqHz must be positive');
  const freqGHz = freqHz / 1e9;
  return entry.dbPerMeterAt2_4GHz * thicknessM * (freqGHz / 2.4) ** entry.frequencyExponent;
}

/**
 * @param {{distanceM: number, freqHz: number, walls?: WallSpec[]}} options
 */
export function pathAttenuationDb({ distanceM, freqHz, walls = [] }) {
  const freeSpace = freeSpacePathLossDb(distanceM, freqHz);
  const wallsDb = walls.reduce(
    (sum, wall) => sum + materialAttenuationDb({ ...wall, freqHz }),
    0,
  );
  return { freeSpaceDb: freeSpace, wallsDb, totalDb: freeSpace + wallsDb };
}

/**
 * @param {{
 *   txPowerDbm: number,
 *   txGainDbi?: number,
 *   rxGainDbi?: number,
 *   distanceM: number,
 *   freqHz: number,
 *   walls?: WallSpec[],
 *   rxSensitivityDbm?: number,
 * }} options
 */
export function linkBudget({
  txPowerDbm,
  txGainDbi = 0,
  rxGainDbi = 0,
  distanceM,
  freqHz,
  walls = [],
  rxSensitivityDbm = -95,
}) {
  const loss = pathAttenuationDb({ distanceM, freqHz, walls });
  const receivedDbm = txPowerDbm + txGainDbi + rxGainDbi - loss.totalDb;
  const marginDb = receivedDbm - rxSensitivityDbm;
  const status =
    marginDb >= 10 ? RF_STATUS.ROBUST : marginDb >= 0 ? RF_STATUS.MARGINAL : RF_STATUS.BLOCKED;
  return { ...loss, receivedDbm, marginDb, status };
}

/**
 * Log-distance inversion with a declared shadowing sigma. The interval is a
 * one-sigma band, not a confidence interval and not a location fix.
 */
export function rssiToDistance({
  rssiDbm,
  txPowerDbm,
  freqHz,
  exponent = 2.7,
  referenceDistanceM = 1,
  shadowingSigmaDb = 6,
}) {
  if (!(exponent > 0)) throw new RangeError('exponent must be positive');
  const pl0 = freeSpacePathLossDb(referenceDistanceM, freqHz);
  const distanceM = referenceDistanceM * 10 ** ((txPowerDbm - rssiDbm - pl0) / (10 * exponent));
  const factor = 10 ** (shadowingSigmaDb / (10 * exponent));
  return {
    distanceM,
    lowM: distanceM / factor,
    highM: distanceM * factor,
    exponent,
    shadowingSigmaDb,
    provenance: 'MODEL_DERIVED_REAL_INPUT',
  };
}

export function presenceLikelihood({ rssiDbm, baselineDbm, sigmaDb = 6 }) {
  if (!(sigmaDb > 0)) throw new RangeError('sigmaDb must be positive');
  const z = (rssiDbm - baselineDbm) / sigmaDb;
  return 1 / (1 + Math.exp(-z));
}

/**
 * @param {{
 *   freqHz: number,
 *   walls?: WallSpec[],
 *   distanceM?: number,
 *   maxPathLossDb?: number,
 * }} options
 */
export function throughWallFeasibility({
  freqHz,
  walls = [],
  distanceM = 5,
  maxPathLossDb = 120,
}) {
  const loss = pathAttenuationDb({ distanceM, freqHz, walls });
  const hasMetal = walls.some((wall) => wall.material === 'metal');
  const hasReinforced = walls.some((wall) => wall.material === 'reinforced_concrete');

  let status;
  if (hasMetal || loss.totalDb > maxPathLossDb) {
    status = hasMetal ? RF_STATUS.BLOCKED_BY_MATERIAL : RF_STATUS.BLOCKED_BY_PATH_LOSS;
  } else if (loss.totalDb > maxPathLossDb * 0.8) {
    status = RF_STATUS.MARGINAL_SIMULATION_ONLY;
  } else {
    status = RF_STATUS.PLAUSIBLE_SIMULATION_ONLY;
  }

  return {
    status,
    capability: 'SIMULATION_ONLY',
    ...loss,
    maxPathLossDb,
    hasMetal,
    hasReinforced,
    note:
      'Un resultado PLAUSIBLE no es detección. Exige radar UWB/mmWave o SDR autorizado, calibración y consentimiento.',
  };
}

export function getRfLegalGates() {
  return RF_LEGAL_GATES.map((gate) => ({ ...gate }));
}
