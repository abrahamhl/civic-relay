/**
 * SENDA · Contrato Canónico de Evidencias, Procedencia y Riesgos.
 *
 * Separa estrictamente hechos OBSERVADOS, ejecuciones SIMULADAS, salidas PREDICHAS,
 * parámetros HIPÓTESIS y fuentes NO VERIFICADAS. Impide que una simulación o
 * reporte ciudadano no anclado genere avisos públicos o autoridad institucional.
 */
import { checkCorroborationIndependence, createSourceEvidence, SOURCE_DEPENDENCY_GRAPH } from './source-evidence.mjs';

export const EPISTEMIC_STATUS = Object.freeze({
  OBSERVADO: 'OBSERVADO',
  SIMULADO: 'SIMULADO',
  PREDICHO: 'PREDICHO',
  HIPOTESIS: 'HIPÓTESIS',
  NO_VERIFICADO: 'NO VERIFICADO',
});

const VALID_EPISTEMIC = new Set(Object.values(EPISTEMIC_STATUS));

const LEGACY_BASIS_MAP = Object.freeze({
  OBSERVED: EPISTEMIC_STATUS.OBSERVADO,
  MEDIDO: EPISTEMIC_STATUS.OBSERVADO,
  OBSERVADO: EPISTEMIC_STATUS.OBSERVADO,
  SIMULATED: EPISTEMIC_STATUS.SIMULADO,
  SIMULATION: EPISTEMIC_STATUS.SIMULADO,
  SIMULACION: EPISTEMIC_STATUS.SIMULADO,
  SIMULACIÓN: EPISTEMIC_STATUS.SIMULADO,
  SIMULADO: EPISTEMIC_STATUS.SIMULADO,
  PREDICTED: EPISTEMIC_STATUS.PREDICHO,
  MODEL_FORECAST: EPISTEMIC_STATUS.PREDICHO,
  PREDICHO: EPISTEMIC_STATUS.PREDICHO,
  HYPOTHESIS: EPISTEMIC_STATUS.HIPOTESIS,
  HIPOTESIS: EPISTEMIC_STATUS.HIPOTESIS,
  HIPÓTESIS: EPISTEMIC_STATUS.HIPOTESIS,
  UNVERIFIED: EPISTEMIC_STATUS.NO_VERIFICADO,
  SIGNED_UNVERIFIED: EPISTEMIC_STATUS.NO_VERIFICADO,
  'FIRMADO SIN VERIFICAR': EPISTEMIC_STATUS.NO_VERIFICADO,
  'NO VERIFICADO': EPISTEMIC_STATUS.NO_VERIFICADO,
});

export function normalizeEpistemicLabel(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return EPISTEMIC_STATUS.NO_VERIFICADO;
  const key = raw.trim().toUpperCase();
  if (VALID_EPISTEMIC.has(key)) return key;
  return LEGACY_BASIS_MAP[key] ?? EPISTEMIC_STATUS.NO_VERIFICADO;
}

const safeIsoOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return null;
};

/**
 * Normaliza cualquier dato o salida de modelo a un registro de evidencia auditable.
 * Ningún registro producido localmente puede activar `canPublicWarn = true`.
 */
export function createEvidenceContractRecord({
  id,
  basis,
  source,
  license = 'NO VERIFICADA',
  observationTime = null,
  downloadTime = null,
  forecastValidTime = null,
  sha256 = null,
  uncertainty = null,
  experimentalOnly = false,
  institutionalAnchorVerified = false,
  notes = '',
} = {}) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new TypeError('Evidence record requires an explicit source identifier');
  }
  const normalizedBasis = normalizeEpistemicLabel(basis);
  const obsIso = safeIsoOrNull(observationTime);
  const dlIso = safeIsoOrNull(downloadTime);
  const fcIso = safeIsoOrNull(forecastValidTime);
  const ageMs = obsIso && dlIso ? Math.max(0, Date.parse(dlIso) - Date.parse(obsIso)) : null;

  const isSimulationOrHypothesis =
    normalizedBasis === EPISTEMIC_STATUS.SIMULADO ||
    normalizedBasis === EPISTEMIC_STATUS.PREDICHO ||
    normalizedBasis === EPISTEMIC_STATUS.HIPOTESIS ||
    normalizedBasis === EPISTEMIC_STATUS.NO_VERIFICADO;

  return Object.freeze({
    id: typeof id === 'string' && id.trim() ? id.trim() : `${source.trim()}-${Date.now()}`,
    basis: normalizedBasis,
    source: source.trim(),
    license: typeof license === 'string' && license.trim() ? license.trim() : 'NO VERIFICADA',
    observationTime: obsIso,
    downloadTime: dlIso,
    forecastValidTime: fcIso,
    ageMs,
    sha256: typeof sha256 === 'string' && /^[a-fA-F0-9]{64}$/.test(sha256) ? sha256.toLowerCase() : null,
    uncertainty: uncertainty && typeof uncertainty === 'object' ? Object.freeze({ ...uncertainty }) : null,
    experimentalOnly: Boolean(experimentalOnly || isSimulationOrHypothesis),
    institutionalAnchorVerified: Boolean(institutionalAnchorVerified && normalizedBasis === EPISTEMIC_STATUS.OBSERVADO),
    // Citizen reports, simulations, and unvalidated models must NEVER trigger public warnings.
    canPublicWarn: false,
    notes: typeof notes === 'string' ? notes : '',
  });
}

/**
 * Puerta epistémica para modelos de pronóstico (p. ej. H2 frente a persistencia y futuro H3).
 * Si el modelo no supera la línea base de persistencia o carece de validación operativa,
 * bloquea avisos públicos y fuerza etiquetado experimental.
 */
export function assessForecastSkillGate({
  modelId = 'H2',
  modelBrier = null,
  persistenceBrier = null,
  biasPp = null,
  heldOutUnits = 0,
  operationalFieldValidated = false,
  institutionalAuthorityVerified = false,
} = {}) {
  const hasScores = Number.isFinite(modelBrier) && Number.isFinite(persistenceBrier);
  const beatsBaseline = hasScores && modelBrier < persistenceBrier;
  const experimentalMode = !beatsBaseline || !operationalFieldValidated;

  let status = 'EXPERIMENTAL_UNVALIDATED';
  let warning = `${modelId} en modo experimental: sin validación operativa ni autoridad de aviso público.`;

  if (hasScores && !beatsBaseline) {
    status = 'EXPERIMENTAL_REJECTED';
    warning =
      `${modelId} en modo experimental (RECHAZADO como predictor operativo): ` +
      `Brier ${modelBrier.toFixed(3)} es peor o igual que la persistencia (${persistenceBrier.toFixed(3)})` +
      (Number.isFinite(biasPp) ? ` con sesgo ${biasPp.toFixed(1)} pp` : '') +
      `. Prohibido generar avisos públicos a partir de ${modelId}.`;
  } else if (beatsBaseline && !operationalFieldValidated) {
    status = 'EXPERIMENTAL_SCIENTIFIC_ONLY';
    warning =
      `${modelId} supera la línea base en retrospectiva (${heldOutUnits} unidades), ` +
      'pero carece de validación operativa y certificación institucional. No usar para avisos públicos.';
  }

  return Object.freeze({
    modelId,
    status,
    basis: EPISTEMIC_STATUS.PREDICHO,
    beatsPersistenceBaseline: beatsBaseline,
    modelBrier: Number.isFinite(modelBrier) ? modelBrier : null,
    persistenceBrier: Number.isFinite(persistenceBrier) ? persistenceBrier : null,
    biasPp: Number.isFinite(biasPp) ? biasPp : null,
    heldOutUnits,
    experimentalOnly: experimentalMode,
    operationalFieldValidated: Boolean(operationalFieldValidated),
    institutionalAuthorityVerified: Boolean(institutionalAuthorityVerified),
    canPublicWarn: false,
    warning,
  });
}

/**
 * Evalúa una lista de fuentes y detecta dependencias circulares o ancestros comunes
 * (p. ej. GDACS_WF vs NASA_FIRMS o GDACS_EQ vs USGS_NEIC).
 */
export function summarizeEvidenceLineage(sourceIds = []) {
  const ids = [...new Set((Array.isArray(sourceIds) ? sourceIds : []).filter((s) => typeof s === 'string' && s.trim()))];
  const pairs = [];
  let independentPairs = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const check = checkCorroborationIndependence(ids[i], ids[j]);
      if (check.independent) independentPairs++;
      pairs.push({ a: ids[i], b: ids[j], ...check });
    }
  }
  const knownCount = ids.filter((id) => Object.hasOwn(SOURCE_DEPENDENCY_GRAPH, id.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))).length;
  return Object.freeze({
    sources: ids,
    knownInGraph: knownCount,
    independentPairs,
    dependentOrUnknownPairs: pairs.length - independentPairs,
    pairs,
    createRecord: (params) => createSourceEvidence(params),
  });
}
