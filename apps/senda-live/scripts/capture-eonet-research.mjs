/**
 * Live read-only research receipt for NASA EONET. This is NOT calibration.
 * A successful download proves API access and a normalized catalog snapshot,
 * never an observed fire perimeter or operational warning.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEonetWildfireFeed } from '../server/domain/eonet-wildfires.mjs';

const start = new Date().toISOString();
const result = await createEonetWildfireFeed({ timeoutMs: 8000 }).read();
const report = {
  schema: 'senda.public-catalog-receipt/1',
  collectedAt: start,
  source: result.source,
  status: result.status,
  count: result.observations.length,
  requestedLimit: result.requestedLimit,
  resultLimitReached: result.resultLimitReached,
  completeness: result.resultLimitReached ? 'CAPPED_SAMPLE_NOT_GLOBAL_TOTAL' : 'UNDER_REQUEST_CAP',
  rejectedEvents: result.rejectedEvents,
  sampleIds: result.observations.slice(0, 5).map((x) => x.id),
  observedWindow: result.observations.length ? {
    oldest: result.observations.at(-1).observedAt,
    newest: result.observations[0].observedAt,
  } : null,
  classification: 'CURATED_EVENT_METADATA',
  calibratedModel: false,
  firePerimeterVerified: false,
  emergencyAlert: false,
  fieldValidation: false,
};
const outDir = resolve('evidence/senda/eonet');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'latest-catalog-acquisition.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
if (result.status !== 'SOURCE_SNAPSHOT') process.exitCode = 2;
