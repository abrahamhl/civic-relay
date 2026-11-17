import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTerrainLink, computeRadioShadowField, estimateEqualMastHeight, fresnelRadiusM,
  greatCircleDistanceM, planRelayCorridor, relaySiteCoordinates,
  terrainAt, validateGeometryTerrain, RELAY_SITES,
} from '../web/src/science/relay-geometry.mjs';

const DEM = () => ({
  schema: 'senda.terrain.grid/1', region: 'valencia',
  dataKind: 'RASTER_DEM_SAMPLES', acquiredAt: '2026-11-09T00:00:00Z',
  rows: 33, columns: 33,
  bounds: { north: 40.12, south: 39.88, west: -0.18, east: 0.18 },
  elevationsM: Array(1089).fill(100),
  georeference: { verticalDatum: 'MIXED_SOURCE_NOT_VALIDATED',
    approximateHeightM: 26_686, approximateWidthM: 30_659 },
  source: { dataset: 'MAPZEN_AWS_TERRARIUM' }
});
const near = { lat: 40, lon: -0.0175 };
const far = { lat: 40, lon: 0.0175 };
function link(terrain = DEM(), height = 30, frequencyMHz = 2400, extra = {}) {
  return analyzeTerrainLink(terrain, {
    from: { ...near, antennaHeightM: height },
    to: { ...far, antennaHeightM: height },
    frequencyMHz, ...extra
  });
}

test('geodesic surface length and Fresnel first-zone radius match analytical formulas', () => {
  const d = greatCircleDistanceM(near, far);
  assert.ok(d > 2950 && d < 3050);
  const f1 = fresnelRadiusM(2400, 1500, 1500);
  const expected = Math.sqrt((299792458 / 2.4e9) * 1500 * 1500 / 3000);
  assert.ok(Math.abs(f1 - expected) < 1e-12);
  assert.equal(fresnelRadiusM(2400, 0, 3000), 0);
});

test('flat earth screening with short distances and elevated antennas is positive but not radio validation', () => {
  const result = link();
  assert.equal(result.schema, 'senda.rf.terrain-screening/1');
  assert.equal(result.dataKind, 'GEOMETRIC_RF_SCREENING');
  assert.equal(result.status, 'MODEL_INDICATES_CLEARANCE');
  assert.equal(result.isMeasuredRadioLink, false);
  assert.equal(result.isAuthorizedGateway, false);
  assert.equal(result.isOperationalConnectivityGuarantee, false);
  assert.equal(result.isCalibrated, false);
  assert.equal(result.profile.length, 65);
  assert.equal(result.from.tipElevationM, 130);
  assert.ok(result.minFresnelClearanceM > 10);
  assert.ok(result.maxFirstFresnelRadiusM > 9);
  assert.ok(result.idealFreeSpaceLossDb > 100 && result.idealFreeSpaceLossDb < 115);
  assert.match(result.assumptions.verticalDatum, /NOT_VALIDATED/);
});

test('high terrain ridge between two ends produces obstruction and identifies bottleneck', () => {
  const dem = DEM();
  for (let row = 13; row <= 19; row++) {
    // Keep both terminal footprints outside the synthetic ridge; compare the true obstruction at mid-path.
    for (let col = 16; col <= 16; col++) dem.elevationsM[row * 33 + col] = 430;
  }
  const result = link(dem);
  assert.equal(result.status, 'MODEL_INDICATES_OBSTRUCTION');
  assert.ok(result.minFresnelClearanceM < -250);
  assert.ok(Math.abs(result.bottleneckAt.fraction - .5) < .07);
  assert.ok(result.maxFresnelIntrusionM > 200);
});

test('frequency and k-factor sensitivities follow wavelength and bulge physics', () => {
  const lowFreq = link(DEM(), 40, 433);
  const highFreq = link(DEM(), 40, 5800);
  assert.ok(lowFreq.maxFirstFresnelRadiusM > highFreq.maxFirstFresnelRadiusM);
  assert.ok(lowFreq.idealFreeSpaceLossDb < highFreq.idealFreeSpaceLossDb);
  assert.ok(lowFreq.minFresnelClearanceM < highFreq.minFresnelClearanceM);
  const standard = link(DEM(), 40, 2400, { kFactor: 4 / 3 });
  const lessRefraction = link(DEM(), 40, 2400, { kFactor: 1 });
  assert.ok(lessRefraction.maximumEarthBulgeM > standard.maximumEarthBulgeM);
  assert.ok(lessRefraction.minFresnelClearanceM < standard.minFresnelClearanceM);
});

test('low mast is marginal and binary mast solver yields monotonically sufficient height', () => {
  const low = link(DEM(), 3);
  assert.equal(low.status, 'MARGINAL_OR_UNRESOLVED');
  const high = link(DEM(), 50);
  assert.ok(high.minFresnelClearanceM > low.minFresnelClearanceM);
  const estimate = estimateEqualMastHeight(DEM(), { from: near, to: far, frequencyMHz: 2400 });
  assert.equal(estimate.status, 'GEOMETRIC_HEIGHT_ESTIMATE_ONLY');
  assert.ok(estimate.requiredHeightM >= 10 && estimate.requiredHeightM <= 30);
  assert.equal(estimate.fieldVerified, false);
  assert.ok(link(DEM(), estimate.requiredHeightM).minFresnelClearanceM >= 9.9);
});

test('site graph searches hypothetical repeater corridor without implying installed radios', () => {
  const dem = DEM();
  assert.equal(RELAY_SITES.length, 7);
  for (const site of RELAY_SITES) {
    const coords = relaySiteCoordinates(dem, site.id);
    assert.ok(Number.isFinite(terrainAt(dem, coords.lat, coords.lon)));
  }
  const result = planRelayCorridor(dem, {
    startSite: 'A', endSite: 'E', frequencyMHz: 2400,
    mastHeightM: 70, maxHopKm: 15
  });
  assert.equal(result.status, 'GEOMETRIC_RELAY_CANDIDATE');
  assert.ok(result.hopCount >= 2);
  assert.equal(result.candidateSiteIds.at(0), 'A');
  assert.equal(result.candidateSiteIds.at(-1), 'E');
  assert.equal(result.actualStationsKnown, false);
  assert.equal(result.ownerAuthorizationRequired, true);
  assert.equal(result.fieldMeasurementRequired, true);
  assert.ok(result.allScreenedEdges.every((e) => e.distanceM <= 15000));
});

test('range cap returns no geometric route rather than inventing an RF relay', () => {
  const result = planRelayCorridor(DEM(), { maxHopKm: 0.1, mastHeightM: 10 });
  assert.equal(result.status, 'NO_GEOMETRIC_ROUTE_FOUND');
  assert.deepEqual(result.candidateSiteIds, []);
  assert.equal(result.hopCount, null);
});

test('bad input, outside-of-DEM, degenerate links, impossible frequency and forged raster are fail-closed', () => {
  assert.throws(() => terrainAt(DEM(), 41, 1), /LOCATION_OUTSIDE_DEM/);
  assert.throws(() => relaySiteCoordinates(DEM(), 'INVALID'), /UNKNOWN_RELAY_SITE/);
  assert.throws(() => analyzeTerrainLink(DEM(), {
    from: { ...near, antennaHeightM: 50 }, to: { ...near, antennaHeightM: 50 }
  }), /LINK_DISTANCE_OUT_OF_RESEARCH_RANGE/);
  assert.throws(() => link(DEM(), 40, 10), /INVALID_GEOMETRY_OPTIONS/);
  assert.throws(() => planRelayCorridor(DEM(), { startSite: 'A', endSite: 'A' }), /INVALID_RELAY_GRAPH_REQUEST/);
  const bad = DEM(); bad.elevationsM[20] = NaN;
  assert.throws(() => validateGeometryTerrain(bad), /INVALID_TERRAIN_GRID/);
});

test('all outputs preserve source DEM provenance and declare limitations rather than operator confidence', () => {
  const r = link();
  assert.equal(r.sourceDataset, 'MAPZEN_AWS_TERRARIUM');
  assert.equal(r.assumptions.decisionBufferMeaning, 'HEURISTIC_NOT_CALIBRATED_UNCERTAINTY');
  assert.equal(r.assumptions.diffraction, 'NOT_MODELED');
  assert.equal(r.assumptions.obstacles, 'BUILDINGS_TREES_CLUTTER_NOT_INCLUDED');
});


test('offline radio shadow grid contains only derived DEM screening, not measured coverage', () => {
  const map = computeRadioShadowField(DEM(), {
    originSite: 'A', frequencyMHz: 2400,
    transmitterHeightM: 100, receiverHeightM: 75,
    gridSize: 11, maxRangeKm: 40
  });
  assert.equal(map.schema, 'senda.rf.terrain-shadow-field/1');
  assert.equal(map.dataKind, 'HYPOTHETICAL_GEOMETRIC_VISIBILITY');
  assert.equal(map.cells.length, 121);
  assert.equal(Object.values(map.summary).reduce((a, b) => a + b, 0), 121);
  assert.ok(map.summary.modelClear > 50);
  assert.equal(map.measuredCoverage, false);
  assert.equal(map.fieldValidated, false);
  assert.equal(map.diffractionModeled, false);
  assert.ok(map.cells.every((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon)));
});

test('radio shadow field finds more geometrically shadowed sectors behind a synthetic ridge', () => {
  const flat = DEM(), ridge = DEM();
  for (let row = 0; row < 33; row++) ridge.elevationsM[row * 33 + 16] = 850;
  const options = { originSite: 'A', frequencyMHz: 2400,
    transmitterHeightM: 60, receiverHeightM: 30,
    gridSize: 9, maxRangeKm: 40 };
  const baseline = computeRadioShadowField(flat, options);
  const obstructed = computeRadioShadowField(ridge, options);
  assert.ok(obstructed.summary.modelObstructed > baseline.summary.modelObstructed);
  assert.equal(obstructed.cells.length, 81);
});

test('radio shadow rejects invalid grid sizes and arbitrary user-origin points', () => {
  assert.throws(() => computeRadioShadowField(DEM(), { gridSize: 100 }), /INVALID_RADIO_SHADOW_OPTIONS/);
  assert.throws(() => computeRadioShadowField(DEM(), { originSite: 'my-phone' }), /UNKNOWN_RELAY_SITE/);
  assert.throws(() => computeRadioShadowField(DEM(), { frequencyMHz: -1 }), /INVALID_RADIO_SHADOW_OPTIONS/);
});


test('performance: RF shadow grid validates DEM once, not all 1089 cells for every line sample', () => {
  const terrain = DEM();
  let numericReads = 0;
  terrain.elevationsM = new Proxy(terrain.elevationsM, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) numericReads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const field = computeRadioShadowField(terrain, {
    originSite: 'A', gridSize: 11, frequencyMHz: 2400,
    transmitterHeightM: 45, receiverHeightM: 15,
    maxRangeKm: 40
  });
  assert.equal(field.cells.length, 121);
  assert.ok(numericReads < 80_000,
    'Repeated full DEM validation per sample regressed: ' + numericReads + ' elevation reads');
});

test('public terrainAt still rejects invalid DEM and optimized internal LOS retains endpoint guards', () => {
  const invalid = DEM();
  invalid.elevationsM[500] = NaN;
  assert.throws(() => terrainAt(invalid, 40, 0), /INVALID_TERRAIN_GRID/);
  assert.throws(() => analyzeTerrainLink(invalid, {
    from: { ...near, antennaHeightM: 30 }, to: { ...far, antennaHeightM: 30 }
  }), /INVALID_TERRAIN_GRID/);
  assert.throws(() => computeRadioShadowField(invalid, { gridSize: 11 }), /INVALID_TERRAIN_GRID/);
  assert.throws(() => planRelayCorridor(invalid, {}), /INVALID_TERRAIN_GRID/);
  assert.throws(() => link(DEM(), 30, 2400, {
    to: { lat: 40.5, lon: 0.02, antennaHeightM: 30 }
  }), /LOCATION_OUTSIDE_DEM/);
});

test('mast-height clearance printed in report corresponds to rounded suggested mast value', () => {
  const estimate = estimateEqualMastHeight(DEM(), {
    from: near, to: far, frequencyMHz: 868, minMastM: 2, maxMastM: 120
  });
  assert.equal(estimate.status, 'GEOMETRIC_HEIGHT_ESTIMATE_ONLY');
  const reproducible = link(DEM(), estimate.requiredHeightM, 868);
  assert.equal(estimate.limitingClearanceM, reproducible.minFresnelClearanceM);
});
