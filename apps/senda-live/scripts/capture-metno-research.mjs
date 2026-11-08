/**
 * One-shot public source receipt; never scheduled in standard CI because MET Norway
 * requires disciplined request caching (3h for global forecasts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMetNorwayGridFeed } from '../server/domain/metno-weather-grid.mjs';

const region = process.argv[2] || 'valencia';
const result = await createMetNorwayGridFeed({ timeoutMs: 10_000 }).read(region);
const report = {
  schema: 'senda.metno-source-receipt/1',
  checkedAt: new Date().toISOString(),
  region,
  status: result.status,
  source: result.source,
  hourlySteps: result.times.length,
  modelGridPoints: result.points.length,
  firstValidAt: result.times[0] || null,
  lastValidAt: result.times.at(-1) || null,
  dataKind: result.dataKind,
  anyRealStationMeasurement: false,
  physicalForecastCalibration: false,
  weatherAlertIssued: false,
  readyForOperationalDeployment: false,
  validStructure: result.status === 'SOURCE_SNAPSHOT' && result.points.length === 9 && result.times.length === 24,
};
const dir = resolve('evidence/senda/metno');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'latest-acquisition.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.validStructure) process.exitCode = 2;
