#!/usr/bin/env node
/**
 * H-FIRE-B exploratory multi-incident evaluation on REAL in-repo NOAA GOES-R + HRRR data.
 * camp (2018) is DEVELOPMENT_DIAGNOSTIC_ONLY and excluded from the aggregate.
 * <10 incidents -> EXPLORATORY per preregister; never a confirmatory or operational claim.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGoesCase, bootstrapMeanCi, HRRR_AVAILABILITY_LAG_MS } from '../src/goes-case-eval.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const dataPath = resolve(repo, 'investor-next/public/senda/data/referencias/goes_casos.json');
const raw = readFileSync(dataPath);
const data = JSON.parse(raw.toString('utf8'));
const DEV_ONLY = new Set(['camp']);
const HORIZON_H = Number(process.env.FIRE_HORIZON_H || 3);

const perIncident = {};
const t0 = performance.now();
for (const [name, c] of Object.entries(data.casos)) {
  const ev = evaluateGoesCase(c, { horizonH: HORIZON_H });
  const scored = ev.origins.filter((o) => o.status === 'SCORED');
  const mean = (f) => (scored.length ? scored.reduce((a, o) => a + f(o), 0) / scored.length : null);
  perIncident[name] = {
    role: DEV_ONLY.has(name) ? 'DEVELOPMENT_DIAGNOSTIC_ONLY' : 'EXPLORATORY_EXTERNAL',
    satellite: c.satelite,
    grid: ev.grid,
    origins: ev.origins.length,
    scored: scored.length,
    abstained: ev.origins.filter((o) => o.status === 'ABSTAIN').length,
    excludedNoGrowth: ev.origins.filter((o) => o.status === 'EXCLUDED').length,
    meanGrowthCsi: { levelSet: mean((o) => o.growthCsi.levelSet), isotropicAreaMatched: mean((o) => o.growthCsi.isotropicAreaMatched), persistence: scored.length ? 0 : null },
    meanIou: { levelSet: mean((o) => o.iou.levelSet), isotropicAreaMatched: mean((o) => o.iou.isotropicAreaMatched), persistence: mean((o) => o.iou.persistence) },
    originsDetail: ev.origins,
  };
}
const external = Object.entries(perIncident).filter(([, v]) => v.role === 'EXPLORATORY_EXTERNAL' && v.scored > 0);
const dCsi = external.map(([, v]) => v.meanGrowthCsi.levelSet - v.meanGrowthCsi.isotropicAreaMatched);
const dIouPers = external.map(([, v]) => v.meanIou.levelSet - v.meanIou.persistence);
const ciCsi = bootstrapMeanCi(dCsi);
const ciIou = bootstrapMeanCi(dIouPers);
const wins = dCsi.filter((d) => d > 0).length;

const result = {
  schema: 'senda-fire-real-cases/1',
  hypothesis: 'H-FIRE-B',
  generatedBy: 'experimental/senda-fire-physics/experiments/run-fire-real-cases.mjs',
  dataset: {
    path: 'investor-next/public/senda/data/referencias/goes_casos.json',
    sha256: createHash('sha256').update(raw).digest('hex'),
    source: data.fuente,
  },
  protocol: {
    horizonH: HORIZON_H,
    gridDxM: 1000,
    hotspotRadiusKm: 1.0,
    t0Step: 'every horizon, from first detection + 1 h',
    causalGate: `HRRR sample used only if validUTC + ${HRRR_AVAILABILITY_LAG_MS / 60000} min <= t0 (assumed latency)`,
    target: 'cumulative GOES hotspot footprint at t0+H (NOT a mapped perimeter)',
    comparators: ['LEVEL_SET_UPWIND_HRRR_WIND', 'ISOTROPIC_AREA_MATCHED (same predicted area as level-set)', 'PERSISTENCE'],
    primaryMetric: 'growth CSI on newly observed cells (directional skill, area held equal)',
    statisticalUnit: 'incident (origins within an incident are NOT independent)',
    bootstrap: '10,000 percentile resamples over incident-level means, seed 20261117',
  },
  limitations: [
    'No DEM / fuel map in archive for US cases: flat terrain + uniform SHRUB fuel (code 2). Only wind-directional skill is tested.',
    'GOES ABI pixels ~2 km+ ; hotspots suffer omission under smoke/cloud and commission; footprint != perimeter.',
    'HRRR is a single point time series per incident (no spatial field).',
    'HRRR availability latency is an assumption (60 min), not a logged publication time.',
    'Rate of spread is uncalibrated (rosMult=1); area-matched isotropic baseline isolates direction, not magnitude.',
    'n=6 independent incidents < 10 -> EXPLORATORY only per preregister; no confirmatory claim.',
  ],
  perIncident,
  aggregateExternal: {
    incidents: external.map(([k]) => k),
    deltaGrowthCsi_levelSet_minus_isotropic: ciCsi,
    deltaIou_levelSet_minus_persistence: ciIou,
    incidentsLevelSetBeatsIsotropic: `${wins}/${external.length}`,
  },
  smv2026: {
    status: 'NOT_EVALUATED',
    reason: 'Sentinel-2 burn scars (d0724 -> d0729 -> d0808) are 5-10 days apart while the in-repo GFS run covers only 12 h (2026-07-23T12Z..2026-07-24T00Z); no causally matched forcing for that horizon.',
  },
  decision: ciCsi && ciCsi.lo > 0 ? 'EXPLORATORY_SUPPORT_NOT_CONFIRMATORY' : 'INCONCLUSIVE_OR_NOT_SUPPORTED',
  operationalUse: { canIssueEvacuationOrder: false, canPublicWarn: false, evidenceKind: 'PREDICTED' },
  runtimeMs: Math.round(performance.now() - t0),
};
const out = resolve(here, '../results/fire-real-cases.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ aggregate: result.aggregateExternal, decision: result.decision, perIncident: Object.fromEntries(Object.entries(perIncident).map(([k, v]) => [k, { role: v.role, scored: v.scored, abstained: v.abstained, excl: v.excludedNoGrowth, csi: v.meanGrowthCsi, iou: v.meanIou }])) }, null, 2));
