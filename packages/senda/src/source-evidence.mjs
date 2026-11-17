/**
 * SENDA Source Evidence & Epistemic Dependency Registry (L4.4 / P0 Closure)
 *
 * Implements:
 * 1. SourceEvidence v1 state machine:
 *    DISCOVERED → SCHEMA_VALIDATED → LIVE_FETCHED → INTEGRATED → HOLDOUT_TESTED → FIELD_VALIDATED
 * 2. Epistemic Source Dependency Graph:
 *    Explicitly tracks upstream lineage to prevent circular or false corroboration.
 *    For example:
 *    - GDACS-EQ derives from USGS NEIC / EMSC.
 *    - GDACS-WF derives from GWIS / NASA FIRMS / EFFIS.
 *    - GDACS-FL derives from GloFAS (hydrological simulation model).
 *    Treating GDACS and USGS as two independent confirmations of an earthquake is an epistemic error.
 */

export const EVIDENCE_STAGES = [
  'DISCOVERED',
  'SCHEMA_VALIDATED',
  'LIVE_FETCHED',
  'INTEGRATED',
  'HOLDOUT_TESTED',
  'FIELD_VALIDATED'
];

/**
 * Known upstream lineage graph for emergency and hazard feeds.
 */
export const SOURCE_DEPENDENCY_GRAPH = {
  // Earthquakes
  'GDACS_EQ': {
    upstream: ['USGS_NEIC', 'EMSC'],
    kind: 'AGGREGATED_FEED',
    description: 'GDACS Earthquake alerts ingest primary solutions from USGS NEIC and EMSC.'
  },
  'USGS_NEIC': {
    upstream: ['GLOBAL_SEISMOGRAPHIC_NETWORK'],
    kind: 'PRIMARY_OBSERVATORY',
    description: 'USGS National Earthquake Information Center.'
  },
  'EMSC': {
    upstream: ['EURO_MED_SEISMIC_NETWORKS'],
    kind: 'PRIMARY_OBSERVATORY',
    description: 'Euro-Mediterranean Seismological Centre.'
  },

  // Wildfires
  'GDACS_WF': {
    upstream: ['GWIS', 'NASA_FIRMS', 'COPERNICUS_EFFIS'],
    kind: 'AGGREGATED_FEED',
    description: 'GDACS Wildfire alerts derive from GWIS which aggregates VIIRS/MODIS FIRMS and EFFIS.'
  },
  'NASA_FIRMS': {
    upstream: ['MODIS_TERRA_AQUA', 'VIIRS_SNPP_NOAA'],
    kind: 'PRIMARY_OBSERVATION_HOTSPOT',
    description: 'NASA FIRMS active fire pixels (hotspots, NOT burnt polygons).'
  },
  'COPERNICUS_EFFIS': {
    upstream: ['NASA_FIRMS', 'MET_NORWAY', 'ECMWF'],
    kind: 'DERIVED_RISK_INDEX',
    description: 'European Forest Fire Information System fire weather index and active fires.'
  },

  // Floods
  'GDACS_FL': {
    upstream: ['COPERNICUS_GLOFAS'],
    kind: 'MODEL_SIMULATION',
    description: 'GDACS Flood alerts are based on GloFAS numerical hydrological simulations, NOT direct observation.'
  },
  'COPERNICUS_GLOFAS': {
    upstream: ['ECMWF_ERA5', 'LISFLOOD_HYDROLOGY_MODEL'],
    kind: 'SIMULATION_ENGINE',
    description: 'Global Flood Awareness System hydrological modeling.'
  },
  'COPERNICUS_EMS_RAPID': {
    upstream: ['ESA_SENTINEL_1', 'ESA_SENTINEL_2', 'COMMERCIAL_VHR_SATELLITES'],
    kind: 'CARTOGRAPHIC_PRODUCT',
    description: 'Copernicus EMS Rapid Mapping delineations and flood perimeters.'
  },
  'COPERNICUS_CDSE': {
    upstream: ['ESA_SENTINEL_HUB'],
    kind: 'PRIMARY_CATALOG_STAC',
    description: 'Copernicus Data Space Ecosystem STAC discovery.'
  }
};

/**
 * Checks whether two sources can independently corroborate each other.
 * If they share common upstream lineage, returns false with reason SAME_UPSTREAM_NOT_CORROBORATION.
 */
export function checkCorroborationIndependence(sourceA, sourceB) {
  if (!sourceA || !sourceB) {
    return { independent: false, reason: 'INVALID_SOURCE_IDENTIFIERS' };
  }

  const idA = String(sourceA).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const idB = String(sourceB).toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  if (idA === idB) {
    return {
      independent: false,
      reason: 'IDENTICAL_SOURCE',
      sharedUpstream: [idA]
    };
  }

  // Get recursive upstream dependencies for source A and source B
  const lineageA = getFullUpstreamLineage(idA);
  const lineageB = getFullUpstreamLineage(idB);

  // Check if A is upstream of B or B is upstream of A
  if (lineageB.has(idA)) {
    return {
      independent: false,
      reason: 'UPSTREAM_DEPENDENCY',
      details: `${idA} is an upstream source of ${idB}. Corroboration is circular.`
    };
  }
  if (lineageA.has(idB)) {
    return {
      independent: false,
      reason: 'UPSTREAM_DEPENDENCY',
      details: `${idB} is an upstream source of ${idA}. Corroboration is circular.`
    };
  }

  // Check for shared upstream nodes
  const shared = [];
  for (const upA of lineageA) {
    if (lineageB.has(upA)) {
      shared.push(upA);
    }
  }

  if (shared.length > 0) {
    return {
      independent: false,
      reason: 'SAME_UPSTREAM_NOT_CORROBORATION',
      sharedUpstream: shared,
      details: `Sources ${idA} and ${idB} share common upstream data providers: ${shared.join(', ')}.`
    };
  }

  return {
    independent: true,
    reason: 'INDEPENDENT_PROVENANCE',
    lineageA: Array.from(lineageA),
    lineageB: Array.from(lineageB)
  };
}

/**
 * Computes the transitive closure of upstream dependencies.
 */
export function getFullUpstreamLineage(sourceId) {
  const visited = new Set();
  const queue = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift();
    const entry = SOURCE_DEPENDENCY_GRAPH[current];
    if (entry && Array.isArray(entry.upstream)) {
      for (const parent of entry.upstream) {
        if (!visited.has(parent)) {
          visited.add(parent);
          queue.push(parent);
        }
      }
    }
  }

  return visited;
}

/**
 * Creates a validated SourceEvidence record conforming to the state machine.
 */
export function createSourceEvidence({
  sourceId,
  stage = 'DISCOVERED',
  schemaValid = false,
  rawSha256 = null,
  holdoutScore = null,
  fieldTrialReceiptId = null,
  notes = ''
} = {}) {
  const stageIdx = EVIDENCE_STAGES.indexOf(stage);
  if (stageIdx === -1) {
    throw new Error(`INVALID_STAGE: ${stage}. Expected one of: ${EVIDENCE_STAGES.join(', ')}`);
  }

  // Enforce state transition invariants
  if (stageIdx >= 1 && !schemaValid) {
    throw new Error('SCHEMA_VALIDATION_REQUIRED: Cannot advance beyond DISCOVERED without schemaValid = true');
  }
  if (stageIdx >= 2 && (!rawSha256 || !rawSha256.startsWith('sha256:'))) {
    throw new Error('IMMUTABLE_DIGEST_REQUIRED: Cannot advance to LIVE_FETCHED without valid sha256:... digest');
  }
  if (stageIdx >= 4 && (holdoutScore === null || typeof holdoutScore !== 'number')) {
    throw new Error('HOLDOUT_SCORE_REQUIRED: Cannot advance to HOLDOUT_TESTED without quantitative holdout score');
  }
  if (stageIdx >= 5 && !fieldTrialReceiptId) {
    throw new Error('FIELD_TRIAL_RECEIPT_REQUIRED: Cannot advance to FIELD_VALIDATED without physical field trial receipt');
  }

  return {
    sourceId,
    stage,
    schemaValid,
    rawSha256,
    holdoutScore,
    fieldTrialReceiptId,
    isFieldValidated: stage === 'FIELD_VALIDATED',
    registeredAtUtc: new Date().toISOString(),
    notes
  };
}
