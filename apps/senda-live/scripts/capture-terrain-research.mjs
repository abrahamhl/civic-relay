/**
 * One-time source receipt: Mapzen Terrain Tiles via AWS Open Data.
 * This is sampled raster evidence only and MUST NOT be interpreted as
 * engineering-grade elevations, surveyed flood levels or building geometry.
 * Only run once per deliberate CI calibration investigation.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTerrainGridFeed } from '../server/domain/terrain-grid.mjs';
const region = process.argv[2] || 'valencia';
const result = await createTerrainGridFeed({ timeoutMs: 18_000 }).read(region);
const receipt = {
  schema: 'senda.terrain.source-receipt/1',
  acquiredAt: new Date().toISOString(),
  region, status: result.status,
  dataset: result.source?.dataset || null,
  provider: result.source?.provider || null,
  sourceAttribution: result.source?.attributionUrl || null,
  sourceLicense: result.source?.license || null,
  rows: result.rows, columns: result.columns,
  samples: result.elevationsM.length,
  tileCount: result.source?.tileCount || 0,
  tileDigests: result.source?.rawTileSha256 || [],
  bounds: result.bounds || null,
  minElevationM: result.summary?.minElevationM ?? null,
  maxElevationM: result.summary?.maxElevationM ?? null,
  geoReference: result.georeference || null,
  officialSurvey: false, physicalGroundValidation: false,
  verticalDatumVerified: false, offlineRedistributionCleared: false,
  calibratedEmergencyModel: false,
  usableResearchAcquisition: result.status === 'SOURCE_SNAPSHOT' && result.elevationsM.length === 1089,
};
const dir = resolve('evidence/senda/terrain');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'latest-terrain-acquisition.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.usableResearchAcquisition) process.exitCode = 2;
