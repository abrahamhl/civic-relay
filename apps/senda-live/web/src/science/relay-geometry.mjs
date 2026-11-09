/**
 * SENDA Relay Geometry Lab 1.0 — deterministic, offline, pure earth/DEM/Fresnel geometry.
 *
 * Physical references: ITU-R P.526-16 (2025) Fresnel diffraction framework,
 * ITU-R P.530 (terrestrial line-of-sight planning).
 * NOT a propagation calibration, field measurement, guarantee of radio connectivity,
 * permission to use radio spectrum, or authorized relay/operator discovery.
 *
 * The 33x33 Mapzen DEM has sparse samples and an unverified vertical datum.
 * Buildings, clutter, weather refractivity, antenna pattern, polarization and
 * diffraction loss are NOT modelled here. Labels are always "screening estimate".
 */
export const RELAY_PRESETS = Object.freeze({
  low433: { frequencyMHz: 433, label: '433 MHz · geometría' },
  sr868: { frequencyMHz: 868, label: '868 MHz · geometría' },
  wifi24: { frequencyMHz: 2400, label: '2,4 GHz · geometría' },
  wifi58: { frequencyMHz: 5800, label: '5,8 GHz · geometría' },
});
export const RELAY_SITES = Object.freeze([
  { id: 'A', label: 'Sector oeste', u: 0.10, v: 0.52 },
  { id: 'B', label: 'Elevación noroeste', u: 0.32, v: 0.19 },
  { id: 'C', label: 'Sector central', u: 0.50, v: 0.52 },
  { id: 'D', label: 'Elevación noreste', u: 0.72, v: 0.19 },
  { id: 'E', label: 'Sector este', u: 0.90, v: 0.52 },
  { id: 'F', label: 'Sector suroeste', u: 0.32, v: 0.83 },
  { id: 'G', label: 'Sector sureste', u: 0.72, v: 0.83 },
]);
const EARTH_RADIUS_M = 6371008.8;
const SPEED_LIGHT_MS = 299792458;
const DECISION_BUFFER_M = 10; // fixed heuristic, NOT an empirically calibrated uncertainty
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finite = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;

export function validateGeometryTerrain(grid) {
  if (!grid || grid.schema !== 'senda.terrain.grid/1' || grid.dataKind !== 'RASTER_DEM_SAMPLES' ||
      grid.rows !== 33 || grid.columns !== 33 ||
      !Array.isArray(grid.elevationsM) || grid.elevationsM.length !== 1089 ||
      !grid.elevationsM.every((z) => finite(z, -11000, 9000))) throw Error('INVALID_TERRAIN_GRID');
  const b = grid.bounds;
  if (!b || !finite(b.north, -90, 90) || !finite(b.south, -90, 90) ||
      !finite(b.west, -180, 180) || !finite(b.east, -180, 180) ||
      b.north <= b.south || b.east <= b.west) throw Error('INVALID_TERRAIN_BOUNDS');
  return true;
}
function terrainAtChecked(grid, lat, lon) {
  const { north, south, west, east } = grid.bounds;
  if (!finite(lat, south, north) || !finite(lon, west, east)) throw Error('LOCATION_OUTSIDE_DEM');
  const x = clamp((lon - west) / (east - west) * 32, 0, 32);
  const y = clamp((north - lat) / (north - south) * 32, 0, 32);
  const col = Math.min(31, Math.floor(x)), row = Math.min(31, Math.floor(y));
  const dx = x - col, dy = y - row;
  const z = (r, c) => grid.elevationsM[r * 33 + c];
  return (1 - dy) * ((1 - dx) * z(row, col) + dx * z(row, col + 1)) +
    dy * ((1 - dx) * z(row + 1, col) + dx * z(row + 1, col + 1));
}

// Public entrypoint rejects malformed/stale structures before any sample is used.
// Internal paths validate once per analysis, not once per point (performance and battery).
export function terrainAt(grid, lat, lon) {
  validateGeometryTerrain(grid);
  return terrainAtChecked(grid, lat, lon);
}
export function relaySiteCoordinates(terrain, siteId) {
  validateGeometryTerrain(terrain);
  const site = RELAY_SITES.find((x) => x.id === siteId);
  if (!site) throw Error('UNKNOWN_RELAY_SITE');
  const { north, south, west, east } = terrain.bounds;
  return { siteId, label: site.label,
    lat: north + (south - north) * site.v, lon: west + (east - west) * site.u };
}
export function greatCircleDistanceM(a, b) {
  if (!finite(a.lat, -90, 90) || !finite(b.lat, -90, 90) ||
      !finite(a.lon, -180, 180) || !finite(b.lon, -180, 180)) throw Error('INVALID_ENDPOINT_COORDINATE');
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}
export function fresnelRadiusM(frequencyMHz, distanceFromA, distanceFromB) {
  if (!finite(frequencyMHz, 100, 10000) || distanceFromA < 0 || distanceFromB < 0 ||
      !Number.isFinite(distanceFromA + distanceFromB)) throw Error('INVALID_FRESNEL_INPUT');
  const total = distanceFromA + distanceFromB;
  return total === 0 ? 0 : Math.sqrt((SPEED_LIGHT_MS / (frequencyMHz * 1e6)) *
    distanceFromA * distanceFromB / total);
}
function validEndpoint(terrain, candidate, label) {
  if (!candidate || !finite(candidate.lat, -85, 85) || !finite(candidate.lon, -180, 180) ||
      !finite(candidate.antennaHeightM, 1, 160)) throw Error('INVALID_' + label + '_TERMINAL');
  const elev = terrainAtChecked(terrain, candidate.lat, candidate.lon);
  return { lat: candidate.lat, lon: candidate.lon, antennaHeightM: candidate.antennaHeightM,
    groundElevationM: elev, tipElevationM: elev + candidate.antennaHeightM };
}

/**
 * Samples great-circle approximation at short, fixed regional distances.
 * Uses a spherical Earth bulge d1*d2/(2*k*R), relative DEM heights,
 * and 60% F1 screening criterion. This is a geometric risk indicator only.
 */
function analyzeTerrainLinkChecked(terrain, {
  from, to, frequencyMHz = 2400, kFactor = 4 / 3,
  fresnelFraction = 0.6, decisionBufferM = DECISION_BUFFER_M,
  samples = 65,
} = {}) {
  const a = validEndpoint(terrain, from, 'FROM');
  const b = validEndpoint(terrain, to, 'TO');
  if (!finite(frequencyMHz, 100, 10000) || !finite(kFactor, 0.65, 2.5) ||
      !finite(fresnelFraction, 0, 1) || !finite(decisionBufferM, 0, 100) ||
      !Number.isInteger(samples) || samples < 33 || samples > 257) throw Error('INVALID_GEOMETRY_OPTIONS');
  const D = greatCircleDistanceM(a, b);
  if (D < 100 || D > 100000) throw Error('LINK_DISTANCE_OUT_OF_RESEARCH_RANGE');
  const lambda = SPEED_LIGHT_MS / (frequencyMHz * 1e6);
  let minimumClearanceM = Infinity, maximumIntrusionM = -Infinity, worstSample = 0;
  let maximumEarthBulgeM = 0, maximumFresnelM = 0;
  const profile = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1), d1 = t * D, d2 = D - d1;
    const lat = a.lat + (b.lat - a.lat) * t;
    const lon = a.lon + (b.lon - a.lon) * t;
    const groundM = terrainAtChecked(terrain, lat, lon);
    const earthBulgeM = d1 * d2 / (2 * kFactor * EARTH_RADIUS_M);
    const radioAxisM = (1 - t) * a.tipElevationM + t * b.tipElevationM - earthBulgeM;
    const f1 = Math.sqrt(lambda * d1 * d2 / D);
    const clearanceM = radioAxisM - groundM;
    const bufferedClearanceM = clearanceM - fresnelFraction * f1;
    const intrusionM = groundM + fresnelFraction * f1 - radioAxisM;
    if (bufferedClearanceM < minimumClearanceM) {
      minimumClearanceM = bufferedClearanceM; worstSample = i;
    }
    maximumIntrusionM = Math.max(maximumIntrusionM, intrusionM);
    maximumEarthBulgeM = Math.max(maximumEarthBulgeM, earthBulgeM);
    maximumFresnelM = Math.max(maximumFresnelM, f1);
    profile.push({
      fraction: Number(t.toFixed(4)),
      distanceM: Math.round(d1),
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      groundElevationM: Number(groundM.toFixed(2)),
      rayElevationM: Number(radioAxisM.toFixed(2)),
      firstFresnelM: Number(f1.toFixed(2)),
      clearanceToFresnelM: Number(bufferedClearanceM.toFixed(2))
    });
  }
  const status = minimumClearanceM < -decisionBufferM ? 'MODEL_INDICATES_OBSTRUCTION' :
    minimumClearanceM > decisionBufferM ? 'MODEL_INDICATES_CLEARANCE' : 'MARGINAL_OR_UNRESOLVED';
  const km = D / 1000;
  return {
    schema: 'senda.rf.terrain-screening/1',
    dataKind: 'GEOMETRIC_RF_SCREENING',
    sourceRegion: terrain.region,
    sourceDataset: terrain.source?.dataset ?? 'UNSPECIFIED_DEM',
    terrainAcquiredAt: terrain.acquiredAt || null,
    status,
    isMeasuredRadioLink: false,
    isAuthorizedGateway: false,
    isOperationalConnectivityGuarantee: false,
    isCalibrated: false,
    assumptions: {
      planet: 'Earth sphere', effectiveEarthRadiusFactor: kFactor,
      fresnelClearanceFraction: fresnelFraction,
      decisionBufferM, decisionBufferMeaning: 'HEURISTIC_NOT_CALIBRATED_UNCERTAINTY',
      horizontalPath: 'LOCAL_LINEAR_INTERPOLATION_NOT_GEODESIC_ROUTING',
      terrain: 'SPARSE_DERIVED_DEM_33X33', obstacles: 'BUILDINGS_TREES_CLUTTER_NOT_INCLUDED',
      verticalDatum: terrain.georeference?.verticalDatum ?? 'UNKNOWN',
      diffraction: 'NOT_MODELED', atmosphericRefractivity: 'ASSUMED_BY_K_FACTOR',
    },
    from: a, to: b, frequencyMHz,
    distanceM: Math.round(D),
    wavelengthM: Number(lambda.toFixed(5)),
    idealFreeSpaceLossDb: Number((32.44 + 20 * Math.log10(km) + 20 * Math.log10(frequencyMHz)).toFixed(2)),
    minFresnelClearanceM: Number(minimumClearanceM.toFixed(2)),
    maxFresnelIntrusionM: Number(maximumIntrusionM.toFixed(2)),
    maxFirstFresnelRadiusM: Number(maximumFresnelM.toFixed(2)),
    maximumEarthBulgeM: Number(maximumEarthBulgeM.toFixed(2)),
    bottleneckAt: profile[worstSample],
    profile,
  };
}

export function analyzeTerrainLink(terrain, options = {}) {
  validateGeometryTerrain(terrain);
  return analyzeTerrainLinkChecked(terrain, options);
}

/** Binary search assumes equal mast heights at both ends, not a real deployment approval. */
export function estimateEqualMastHeight(terrain, {
  from, to, frequencyMHz = 2400, kFactor = 4 / 3,
  minMastM = 2, maxMastM = 120, decisionBufferM = DECISION_BUFFER_M,
} = {}) {
  if (!finite(minMastM, 1, 160) || !finite(maxMastM, minMastM, 160)) throw Error('INVALID_MAST_LIMITS');
  validateGeometryTerrain(terrain);
  const compute = (m) => analyzeTerrainLinkChecked(terrain, {
    from: { ...from, antennaHeightM: m }, to: { ...to, antennaHeightM: m },
    frequencyMHz, kFactor, decisionBufferM,
  });
  let low = minMastM, high = maxMastM;
  const top = compute(high);
  if (top.minFresnelClearanceM < decisionBufferM) {
    return { requiredHeightM: null, status: 'NOT_RESOLVED_WITHIN_MAST_LIMIT',
      maxMastM, limitingClearanceM: top.minFresnelClearanceM, fieldVerified: false };
  }
  for (let i = 0; i < 18; i++) {
    const m = (low + high) / 2;
    if (compute(m).minFresnelClearanceM >= decisionBufferM) high = m;
    else low = m;
  }
  const roundedHeightM = Math.ceil(high * 10) / 10;
  return { requiredHeightM: roundedHeightM,
    status: 'GEOMETRIC_HEIGHT_ESTIMATE_ONLY', maxMastM,
    // Report the displayed mast height, not the unrounded search result.
    limitingClearanceM: compute(roundedHeightM).minFresnelClearanceM, fieldVerified: false };
}

/**
 * Offline candidate graph over fixed, NON-INSTALLED hypothetical mast locations.
 * Dijkstra minimizes number of tentative hops; no claim of operator assets.
 */
export function planRelayCorridor(terrain, {
  startSite = 'A', endSite = 'E',
  frequencyMHz = 2400, mastHeightM = 35,
  maxHopKm = 20, decisionBufferM = DECISION_BUFFER_M,
} = {}) {
  validateGeometryTerrain(terrain);
  if (!RELAY_SITES.some((x) => x.id === startSite) ||
      !RELAY_SITES.some((x) => x.id === endSite) || startSite === endSite ||
      !finite(mastHeightM, 1, 160) || !finite(maxHopKm, 0.1, 100) ||
      !finite(decisionBufferM, 0, 100)) throw Error('INVALID_RELAY_GRAPH_REQUEST');
  const sitePosition = new Map(RELAY_SITES.map((site) =>
    [site.id, relaySiteCoordinates(terrain, site.id)]));
  const edges = [];
  for (let i = 0; i < RELAY_SITES.length; i++) {
    for (let j = i + 1; j < RELAY_SITES.length; j++) {
      const from = sitePosition.get(RELAY_SITES[i].id), to = sitePosition.get(RELAY_SITES[j].id);
      if (greatCircleDistanceM(from, to) > maxHopKm * 1000) continue;
      const screening = analyzeTerrainLinkChecked(terrain, {
        from: { ...from, antennaHeightM: mastHeightM },
        to: { ...to, antennaHeightM: mastHeightM },
        frequencyMHz, decisionBufferM,
      });
      edges.push({ fromSite: RELAY_SITES[i].id, toSite: RELAY_SITES[j].id,
        status: screening.status, distanceM: screening.distanceM,
        minClearanceM: screening.minFresnelClearanceM,
        idealFreeSpaceLossDb: screening.idealFreeSpaceLossDb });
    }
  }
  const approved = edges.filter((e) => e.status === 'MODEL_INDICATES_CLEARANCE');
  const queue = [[startSite]];
  const visited = new Set([startSite]);
  let candidate = null;
  while (queue.length) {
    const path = queue.shift();
    const last = path.at(-1);
    if (last === endSite) { candidate = path; break; }
    for (const edge of approved) {
      const next = edge.fromSite === last ? edge.toSite : edge.toSite === last ? edge.fromSite : null;
      if (next && !visited.has(next)) { visited.add(next); queue.push([...path, next]); }
    }
  }
  return {
    schema: 'senda.rf.relay-corridor/1',
    dataKind: 'HYPOTHETICAL_RELAY_SITE_GRAPH',
    startSite, endSite, frequencyMHz, mastHeightM, maxHopKm,
    status: candidate ? 'GEOMETRIC_RELAY_CANDIDATE' : 'NO_GEOMETRIC_ROUTE_FOUND',
    candidateSiteIds: candidate || [],
    hopCount: candidate ? candidate.length - 1 : null,
    allScreenedEdges: edges,
    assumedDeploymentSites: RELAY_SITES.map((x) => ({ ...x, ...sitePosition.get(x.id) })),
    fieldMeasurementRequired: true,
    ownerAuthorizationRequired: true,
    actualStationsKnown: false,
  };
}


/**
 * Hypothetical RF shadow FIELD: one DEM-derived line/Fresnel screening per cell.
 *
 * This may look like a coverage map but is NOT a coverage map. It shows where a
 * specified abstract antenna could have a geometrically unobstructed profile
 * through the sparse DEM, without modeling actual received power, clutter or
 * authorization. Cells are not real-world measured radio coverage samples.
 */
export function computeRadioShadowField(terrain, {
  originSite = 'A', frequencyMHz = 2400,
  transmitterHeightM = 35, receiverHeightM = 15,
  gridSize = 11, maxRangeKm = 35, kFactor = 4 / 3,
} = {}) {
  validateGeometryTerrain(terrain);
  if (!Number.isInteger(gridSize) || gridSize < 7 || gridSize > 15 ||
      !finite(transmitterHeightM, 1, 160) ||
      !finite(receiverHeightM, 1, 160) ||
      !finite(maxRangeKm, 1, 100) || !finite(kFactor, .65, 2.5) ||
      !finite(frequencyMHz, 100, 10000)) throw Error('INVALID_RADIO_SHADOW_OPTIONS');
  const origin = relaySiteCoordinates(terrain, originSite);
  const { north, south, west, east } = terrain.bounds;
  const cells = [];
  const summary = {
    modelClear: 0, modelObstructed: 0,
    modelUncertain: 0, excludedDistance: 0, coincident: 0
  };
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = north + (south - north) * row / (gridSize - 1);
      const lon = west + (east - west) * col / (gridSize - 1);
      const distanceM = greatCircleDistanceM(origin, { lat, lon });
      let status;
      let clearanceM = null;
      if (distanceM < 100) {
        status = 'COINCIDENT_SAMPLE';
        summary.coincident++;
      } else if (distanceM > maxRangeKm * 1000) {
        status = 'EXCLUDED_BY_USER_DISTANCE_LIMIT';
        summary.excludedDistance++;
      } else {
        const result = analyzeTerrainLinkChecked(terrain, {
          from: { ...origin, antennaHeightM: transmitterHeightM },
          to: { lat, lon, antennaHeightM: receiverHeightM },
          frequencyMHz, kFactor, samples: 33
        });
        status = result.status;
        clearanceM = result.minFresnelClearanceM;
        if (status === 'MODEL_INDICATES_CLEARANCE') summary.modelClear++;
        else if (status === 'MODEL_INDICATES_OBSTRUCTION') summary.modelObstructed++;
        else summary.modelUncertain++;
      }
      cells.push({
        row, col, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)),
        distanceM: Math.round(distanceM), status,
        minFresnelClearanceM: clearanceM
      });
    }
  }
  return {
    schema: 'senda.rf.terrain-shadow-field/1',
    dataKind: 'HYPOTHETICAL_GEOMETRIC_VISIBILITY',
    sourceRegion: terrain.region,
    sourceDataset: terrain.source?.dataset ?? 'UNSPECIFIED_DEM',
    originSite, origin: { lat: origin.lat, lon: origin.lon },
    frequencyMHz, transmitterHeightM, receiverHeightM,
    gridSize, maxRangeKm, kFactor,
    cellSize: { approxWidthM: terrain.georeference?.approximateWidthM / (gridSize - 1) || null,
      approxHeightM: terrain.georeference?.approximateHeightM / (gridSize - 1) || null },
    summary, cells,
    measuredCoverage: false, diffractionModeled: false,
    hypotheticalEquipment: true, fieldValidated: false,
  };
}

/**
 * Standard COTS RF Transceiver presets for link budget estimation.
 */
export const LINK_BUDGET_PRESETS = Object.freeze({
  low433: { frequencyMHz: 433, txPowerDbm: 10.0, txGainDbi: 2.15, rxGainDbi: 2.15, cableLossDb: 0.5, bandwidthKHz: 125, noiseFigureDb: 6.0, sensitivityDbm: -135.0, maxRegulatoryEirpDbm: 10.0 },
  sr868: { frequencyMHz: 868, txPowerDbm: 14.0, txGainDbi: 2.15, rxGainDbi: 2.15, cableLossDb: 0.5, bandwidthKHz: 125, noiseFigureDb: 6.0, sensitivityDbm: -137.0, maxRegulatoryEirpDbm: 16.15 },
  wifi24: { frequencyMHz: 2400, txPowerDbm: 20.0, txGainDbi: 3.0, rxGainDbi: 3.0, cableLossDb: 1.0, bandwidthKHz: 20000, noiseFigureDb: 7.0, sensitivityDbm: -92.0, maxRegulatoryEirpDbm: 20.0 },
  wifi58: { frequencyMHz: 5800, txPowerDbm: 23.0, txGainDbi: 5.0, rxGainDbi: 5.0, cableLossDb: 1.5, bandwidthKHz: 40000, noiseFigureDb: 7.5, sensitivityDbm: -85.0, maxRegulatoryEirpDbm: 23.0 },
});

/**
 * Computes a standard radio Link Budget including free space, diffraction, noise floor, and fade margin.
 * NOT an authorized field deployment guarantee or certified spectrum license.
 *
 * @param {object} options
 * @returns {object} Link budget analysis with regulatory checks and viability classification.
 */
export function computeRadioLinkBudget({
  frequencyMHz = 868,
  distanceM = 1000,
  diffractionLossDb = 0,
  rainRateMmHr = 0,
  txPowerDbm = null,
  txGainDbi = null,
  rxGainDbi = null,
  cableLossDb = null,
  bandwidthKHz = null,
  noiseFigureDb = null,
  sensitivityDbm = null,
  requiredMarginDb = 10.0,
} = {}) {
  if (!finite(frequencyMHz, 100, 10000) || !finite(distanceM, 1, 1000000)) {
    throw Error('INVALID_LINK_BUDGET_INPUT');
  }

  // Find nearest preset for transceiver defaults
  let preset = LINK_BUDGET_PRESETS.sr868;
  if (frequencyMHz < 600) preset = LINK_BUDGET_PRESETS.low433;
  else if (frequencyMHz < 1500) preset = LINK_BUDGET_PRESETS.sr868;
  else if (frequencyMHz < 4000) preset = LINK_BUDGET_PRESETS.wifi24;
  else preset = LINK_BUDGET_PRESETS.wifi58;

  const txP = txPowerDbm !== null && finite(txPowerDbm, -40, 50) ? txPowerDbm : preset.txPowerDbm;
  const txG = txGainDbi !== null && finite(txGainDbi, -10, 40) ? txGainDbi : preset.txGainDbi;
  const rxG = rxGainDbi !== null && finite(rxGainDbi, -10, 40) ? rxGainDbi : preset.rxGainDbi;
  const cLoss = cableLossDb !== null && finite(cableLossDb, 0, 20) ? cableLossDb : preset.cableLossDb;
  const bw = bandwidthKHz !== null && finite(bandwidthKHz, 1, 160000) ? bandwidthKHz : preset.bandwidthKHz;
  const nf = noiseFigureDb !== null && finite(noiseFigureDb, 1, 20) ? noiseFigureDb : preset.noiseFigureDb;
  const sens = sensitivityDbm !== null && finite(sensitivityDbm, -160, 0) ? sensitivityDbm : preset.sensitivityDbm;

  const eirpDbm = Number((txP + txG - cLoss).toFixed(2));
  const km = distanceM / 1000;
  const fsplDb = Number((32.44 + 20 * Math.log10(km) + 20 * Math.log10(frequencyMHz)).toFixed(2));

  // ITU-R P.838 approximation for specific rain attenuation
  const freqGhz = frequencyMHz / 1000;
  let kRain = 0.0002;
  let alphaRain = 1.0;
  if (freqGhz >= 5.0) {
    kRain = 0.0016;
    alphaRain = 1.4;
  }
  const rainSpecificDbPerKm = rainRateMmHr > 0.1 ? kRain * Math.pow(rainRateMmHr, alphaRain) : 0;
  const rainLossDb = Number((rainSpecificDbPerKm * km).toFixed(2));

  const totalLossDb = Number((fsplDb + diffractionLossDb + rainLossDb).toFixed(2));
  const rssiDbm = Number((eirpDbm - totalLossDb + rxG - cLoss).toFixed(2));

  // Thermal noise floor = -174 dBm/Hz + 10*log10(BW_Hz) + NF
  const bwHz = bw * 1000;
  const noiseFloorDbm = Number((-174.0 + 10 * Math.log10(bwHz) + nf).toFixed(2));
  const snrDb = Number((rssiDbm - noiseFloorDbm).toFixed(2));
  const fadeMarginDb = Number((rssiDbm - sens).toFixed(2));

  let linkStatus = 'OUTAGE';
  if (fadeMarginDb >= requiredMarginDb) linkStatus = 'VIABLE';
  else if (fadeMarginDb >= 0) linkStatus = 'MARGINAL';

  const isRegulatoryCompliant = eirpDbm <= (preset.maxRegulatoryEirpDbm + 0.1);

  return {
    schema: 'senda.rf.link-budget/1',
    frequencyMHz,
    distanceM: Math.round(distanceM),
    eirpDbm,
    maxRegulatoryEirpDbm: preset.maxRegulatoryEirpDbm,
    isRegulatoryCompliant,
    pathLoss: {
      freeSpaceLossDb: fsplDb,
      diffractionLossDb: Number(diffractionLossDb.toFixed(2)),
      rainLossDb,
      totalLossDb,
    },
    receiver: {
      rssiDbm,
      noiseFloorDbm,
      snrDb,
      sensitivityDbm: sens,
      fadeMarginDb,
      requiredMarginDb,
    },
    linkStatus,
    isViable: linkStatus !== 'OUTAGE',
    disclaimer: 'THEORETICAL_ESTIMATE_NOT_MEASURED_RADIO_LINK',
  };
}

