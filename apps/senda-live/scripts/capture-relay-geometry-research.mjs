/**
 * One-shot integration receipt: actual Mapzen/AWS DEM -> deterministic offline
 * terrain RF geometry -> candidate graph. No live radios, user GPS or radiosight
 * measurements, and no claim of actual communications capability.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTerrainGridFeed } from '../server/domain/terrain-grid.mjs';
import {
  analyzeTerrainLink, estimateEqualMastHeight, planRelayCorridor,
  relaySiteCoordinates
} from '../web/src/science/relay-geometry.mjs';

const region = 'valencia'; // explicit research case, no tracking of app users
const result = await createTerrainGridFeed({ timeoutMs: 18_000 }).read(region);
if (result.status !== 'SOURCE_SNAPSHOT' || result.elevationsM?.length !== 1089) {
  console.log(JSON.stringify({ status: 'SOURCE_UNAVAILABLE', source: 'MAPZEN_AWS_TERRARIUM' }));
  process.exit(2);
}
const start = relaySiteCoordinates(result, 'A');
const end = relaySiteCoordinates(result, 'E');
const analyzed = [];
for (const frequencyMHz of [433, 868, 2400, 5800]) {
  for (const antennaHeightM of [20, 60]) {
    const screening = analyzeTerrainLink(result, {
      from: { lat: start.lat, lon: start.lon, antennaHeightM },
      to: { lat: end.lat, lon: end.lon, antennaHeightM },
      frequencyMHz,
    });
    analyzed.push({
      frequencyMHz, antennaHeightM,
      status: screening.status, distanceM: screening.distanceM,
      minFresnelClearanceM: screening.minFresnelClearanceM,
      idealFreeSpaceLossDb: screening.idealFreeSpaceLossDb,
      bottleneck: screening.bottleneckAt,
    });
  }
}
const candidate = planRelayCorridor(result, {
  startSite: 'A', endSite: 'E', frequencyMHz: 868,
  mastHeightM: 60, maxHopKm: 15
});
const antennaEstimate = estimateEqualMastHeight(result, {
  from: { lat: start.lat, lon: start.lon },
  to: { lat: end.lat, lon: end.lon }, frequencyMHz: 868,
});
const receipt = {
  schema: 'senda.rf.real-dem-screening-receipt/1',
  computedAt: new Date().toISOString(),
  dataKind: 'GEOMETRIC_RF_SCREENING',
  terrain: {
    region: result.region, dataset: result.source.dataset,
    acquiredAt: result.acquiredAt, rawTileSha256: result.source.rawTileSha256,
    geographicBounds: result.bounds,
    elevationMinM: result.summary.minElevationM,
    elevationMaxM: result.summary.maxElevationM,
    sampleCount: result.elevationsM.length,
    derivedGridSha256: createHash('sha256').update(JSON.stringify(result.elevationsM)).digest('hex')
  },
  endpoints: { start, end, positionsHypothetical: true },
  linkSensitivity: analyzed,
  equalMastEstimate: antennaEstimate,
  relayCandidate: {
    status: candidate.status, hopCount: candidate.hopCount,
    candidateSiteIds: candidate.candidateSiteIds,
    physicallyInstalledNodes: false, authorizedNetworkNodes: false,
  },
  method: {
    localLinearGroundProfile: true, fresnelFraction: .6,
    assumedEarthKFactor: 4 / 3,
    assumptionsUncalibrated: true, empiricalRfMeasurements: 0,
    realRadioTransmissionTest: false, secureNetworkRoutingVerified: false,
    buildingAndVegetationObstructionModelled: false,
    verticalDatumVerified: false,
  }
};
const dir = resolve('evidence/senda/rf');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'real-dem-link-screening.json'),
  JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  status: 'SOURCE_SNAPSHOT', terrainSampleCount: receipt.terrain.sampleCount,
  distanceM: analyzed[0].distanceM, checkedFrequencyCount: 4,
  checkedMastCount: 2, sensitivityResults: analyzed.length,
  corridorStatus: candidate.status, hopCount: candidate.hopCount,
  derivedGridSha256: receipt.terrain.derivedGridSha256,
  measuredRadioLinks: 0, fullyEmpiricallyCalibrated: false
}, null, 2));
